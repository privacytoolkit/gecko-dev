/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef gfx_layers_ipc_ImageBridgeParent_h_
#define gfx_layers_ipc_ImageBridgeParent_h_

#include <stddef.h>  // for size_t
#include <stdint.h>  // for uint32_t, uint64_t
#include "CompositableTransactionParent.h"
#include "mozilla/Assertions.h"  // for MOZ_ASSERT_HELPER2
#include "mozilla/Attributes.h"  // for override
#include "mozilla/ipc/ProtocolUtils.h"
#include "mozilla/ipc/SharedMemory.h"  // for SharedMemory, etc
#include "mozilla/layers/CompositorThread.h"
#include "mozilla/layers/PImageBridgeParent.h"
#include "nsISupportsImpl.h"
#include "nsTArrayForwardDeclare.h"  // for nsTArray

class MessageLoop;

namespace base {
class Thread;
}  // namespace base

namespace mozilla {
namespace ipc {
class Shmem;
}  // namespace ipc

namespace layers {

struct ImageCompositeNotificationInfo;

/**
 * ImageBridgeParent is the manager Protocol of async Compositables.
 */
class ImageBridgeParent final : public PImageBridgeParent,
                                public CompositableParentManager,
                                public ShmemAllocator {
 public:
  typedef nsTArray<CompositableOperation> EditArray;
  typedef nsTArray<OpDestroy> OpDestroyArray;

 protected:
  ImageBridgeParent(MessageLoop* aLoop, ProcessId aChildProcessId);

 public:
  virtual ~ImageBridgeParent();

  /**
   * Creates the globals of ImageBridgeParent.
   */
  static void Setup();

  static ImageBridgeParent* CreateSameProcess();
  static bool CreateForGPUProcess(Endpoint<PImageBridgeParent>&& aEndpoint);
  static bool CreateForContent(Endpoint<PImageBridgeParent>&& aEndpoint);
  static void Shutdown();

  ShmemAllocator* AsShmemAllocator() override { return this; }

  void ActorDestroy(ActorDestroyReason aWhy) override;

  // CompositableParentManager
  void SendAsyncMessage(
      const nsTArray<AsyncParentMessageData>& aMessage) override;

  void NotifyNotUsed(PTextureParent* aTexture,
                     uint64_t aTransactionId) override;

  base::ProcessId GetChildProcessId() override { return OtherPid(); }

  // PImageBridge
  mozilla::ipc::IPCResult RecvUpdate(EditArray&& aEdits,
                                     OpDestroyArray&& aToDestroy,
                                     const uint64_t& aFwdTransactionId);

  PTextureParent* AllocPTextureParent(
      const SurfaceDescriptor& aSharedData, const ReadLockDescriptor& aReadLock,
      const LayersBackend& aLayersBackend, const TextureFlags& aFlags,
      const uint64_t& aSerial,
      const wr::MaybeExternalImageId& aExternalImageId);
  bool DeallocPTextureParent(PTextureParent* actor);

  mozilla::ipc::IPCResult RecvNewCompositable(
      const CompositableHandle& aHandle, const TextureInfo& aInfo,
      const LayersBackend& aLayersBackend);
  mozilla::ipc::IPCResult RecvReleaseCompositable(
      const CompositableHandle& aHandle);

  PMediaSystemResourceManagerParent* AllocPMediaSystemResourceManagerParent();
  bool DeallocPMediaSystemResourceManagerParent(
      PMediaSystemResourceManagerParent* aActor);

  // Shutdown step 1
  mozilla::ipc::IPCResult RecvWillClose();

  MessageLoop* GetMessageLoop() const { return mMessageLoop; }

  // ShmemAllocator

  bool AllocShmem(size_t aSize, ipc::SharedMemory::SharedMemoryType aType,
                  ipc::Shmem* aShmem) override;

  bool AllocUnsafeShmem(size_t aSize, ipc::SharedMemory::SharedMemoryType aType,
                        ipc::Shmem* aShmem) override;

  void DeallocShmem(ipc::Shmem& aShmem) override;

  bool IsSameProcess() const override;

  static already_AddRefed<ImageBridgeParent> GetInstance(ProcessId aId);

  static bool NotifyImageComposites(
      nsTArray<ImageCompositeNotificationInfo>& aNotifications);

  bool UsesImageBridge() const override { return true; }

  bool IPCOpen() const override { return !mClosed; }

  // See PluginInstanceParent for details on the Windows async plugin
  // rendering protocol.
  mozilla::ipc::IPCResult RecvMakeAsyncPluginSurfaces(
      SurfaceFormat aFormat, IntSize aSize, SurfaceDescriptorPlugin* aSD);
  mozilla::ipc::IPCResult RecvUpdateAsyncPluginSurface(
      const SurfaceDescriptorPlugin& aSD);
  mozilla::ipc::IPCResult RecvReadbackAsyncPluginSurface(
      const SurfaceDescriptorPlugin& aSD, SurfaceDescriptor* aResult);
  mozilla::ipc::IPCResult RecvRemoveAsyncPluginSurface(
      const SurfaceDescriptorPlugin& aSD, bool aIsFrontSurface);

  RefPtr<TextureHost> LookupTextureHost(
      const SurfaceDescriptorPlugin& aDescriptor);

 protected:
  void Bind(Endpoint<PImageBridgeParent>&& aEndpoint);

 private:
  static void ShutdownInternal();

  void DeferredDestroy();
  MessageLoop* mMessageLoop;
  // This keeps us alive until ActorDestroy(), at which point we do a
  // deferred destruction of ourselves.
  RefPtr<ImageBridgeParent> mSelfRef;

  bool mClosed;

  /**
   * Map of all living ImageBridgeParent instances
   */
  typedef std::map<base::ProcessId, ImageBridgeParent*> ImageBridgeMap;
  static ImageBridgeMap sImageBridges;

  RefPtr<CompositorThreadHolder> mCompositorThreadHolder;

#if defined(OS_WIN)
  // Owns a pair of textures used to double-buffer a plugin async rendering
  // instance.
  struct PluginTextureDatas {
    UniquePtr<D3D11TextureData> mPluginTextureData;
    UniquePtr<D3D11TextureData> mDisplayTextureData;

    PluginTextureDatas(UniquePtr<D3D11TextureData>&& aPluginTextureData,
                       UniquePtr<D3D11TextureData>&& aDisplayTextureData);

    ~PluginTextureDatas();

    PluginTextureDatas(const PluginTextureDatas& o) = delete;
    PluginTextureDatas& operator=(const PluginTextureDatas& o) = delete;

    bool IsValid() { return mPluginTextureData && mDisplayTextureData; }
  };

  HashMap<WindowsHandle, RefPtr<TextureHost>> mGPUVideoTextureHosts;
  HashMap<WindowsHandle, UniquePtr<PluginTextureDatas>> mPluginTextureDatas;
#endif  // defined(OS_WIN)
};

}  // namespace layers
}  // namespace mozilla

#endif  // gfx_layers_ipc_ImageBridgeParent_h_
