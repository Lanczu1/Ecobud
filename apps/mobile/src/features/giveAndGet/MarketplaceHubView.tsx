import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, BackHandler, DeviceEventEmitter } from 'react-native';
import { ecoTheme, useTheme } from '../../shared/theme/ecoTheme';
import type { EcoBudMobileModel } from '../../app/types/home';
import { TopNavbar } from '../../app/components/CommonComponents';
import { MarketplaceFeed } from './MarketplaceFeed';
import { CreateSwapListing } from './CreateSwapListing';
import { SwapListingDetail } from './SwapListingDetail';
import { SwapRequestDialog, SwapAcceptedDialog } from './SwapRequestDialog';
import { SwapChatView } from './SwapChatView';
import { swapService } from './swapService';
import { ecobudApi } from '../../shared/api/ecobudApi';
import { supabaseClient } from '../../shared/supabase/supabaseClient';
import type { SwapListing, SwapConversation } from './types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ScreenTransition } from '../../shared/ui/ScreenTransition';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import { useInAppNotification } from '../../shared/ui/InAppNotification';

type HubScreen = 'feed' | 'create' | 'detail' | 'chat';
type FeedTab = 'browse' | 'chats' | 'mylistings';

export function MarketplaceHubView({
  model,
  onScreenStateChange,
}: {
  model: EcoBudMobileModel;
  onScreenStateChange?: (isSubScreen: boolean) => void;
}) {
  const { theme } = useTheme();
  const { showNotification } = useInAppNotification();
  const [screen, setScreen] = useState<HubScreen>('feed');
  const [feedTab, setFeedTab] = useState<FeedTab>('browse');
  const [selectedListing, setSelectedListing] = useState<SwapListing | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<SwapConversation | null>(null);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [showAcceptedDialog, setShowAcceptedDialog] = useState(false);
  const [conversations, setConversations] = useState<SwapConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState(false);
  const conversationsRequestId = useRef(0);
  const conversationsInFlight = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const conversationsLoadedFor = useRef<string | null>(null);
  const handleLogoutRef = useRef(model.handleLogout);
  handleLogoutRef.current = model.handleLogout;
  const [showReportDialog, setShowReportDialog] = useState(false);

  useEffect(() => {
    const target = model.notificationDestination;
    const session = model.session;
    if (!target || !session) return;

    let alive = true;
    swapService.init(session.token);
    void (async () => {
      if (['chat', 'conversation', 'swap_request'].includes(target.type)) {
        const all = await swapService.fetchConversations(session.user.id);
        const conversation = all.find(item => item.id === target.id || item.swapRequestId === target.id);
        if (alive && conversation) { setSelectedConversation(conversation); setScreen('chat'); }
        else if (alive) { setFeedTab('chats'); }
      } else {
        const listing = await swapService.fetchListingById(target.id);
        if (alive && listing) { setSelectedListing(listing); setScreen('detail'); }
      }
    })().catch(() => { if (alive) showNotification({ title: 'Content unavailable', message: 'This item may no longer be available.', tone: 'warning' }); }).finally(() => { if (alive) model.setNotificationDestination(null); });
    return () => { alive = false; };
  }, [model.notificationDestination, model.session?.token]);

  const currentUserId = model.session?.user.id || '';
  const token = model.session?.token || '';
  const loadConversations = useCallback(async (showLoading = false) => {
    if (!currentUserId || !token) {
      setConversationsLoading(false);
      return;
    }
    const key = `${currentUserId}:${token}`;
    if (showLoading && conversationsLoadedFor.current !== key) setConversationsLoading(true);
    if (conversationsInFlight.current?.key === key) return conversationsInFlight.current.promise;

    const requestId = ++conversationsRequestId.current;
    const promise = Promise.resolve().then(async () => {
      try {
        swapService.init(token);
        const convs = await swapService.fetchConversations(currentUserId);
        if (requestId === conversationsRequestId.current) {
          setConversations(convs);
          setConversationsError(false);
          conversationsLoadedFor.current = key;
        }
      } catch (err: any) {
        if (requestId !== conversationsRequestId.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        const isAuthExpired = err?.status === 401 || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('unauthorized');
        if (isAuthExpired) {
          void handleLogoutRef.current?.();
        } else {
          setConversationsError(true);
        }
      } finally {
        if (requestId === conversationsRequestId.current) setConversationsLoading(false);
        if (conversationsInFlight.current?.key === key) conversationsInFlight.current = null;
      }
    });
    conversationsInFlight.current = { key, promise };
    return promise;
  }, [currentUserId, token]);

  useEffect(() => {
    loadConversations(true);
  }, [loadConversations]);

  // Hardware back button support within Marketplace (closes dialogs or steps back to feed)
  useEffect(() => {
    const onBackPress = () => {
      // 1. Dismiss any open swap dialog
      if (showSwapDialog) {
        setShowSwapDialog(false);
        return true;
      }
      if (showAcceptedDialog) {
        setShowAcceptedDialog(false);
        return true;
      }

      // 2. Step back from sub-screens (create, detail, chat) to feed
      if (screen === 'chat') {
        setScreen('feed');
        setFeedTab('chats');
        setSelectedConversation(null);
        loadConversations();
        return true;
      }
      if (screen === 'detail') {
        setScreen('feed');
        setSelectedListing(null);
        return true;
      }
      if (screen === 'create') {
        setScreen('feed');
        return true;
      }

      // 3. Let parent shell (useHomeDashboard tab history) handle back navigation
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [showSwapDialog, showAcceptedDialog, screen, loadConversations]);


  useEffect(() => {
    onScreenStateChange?.(screen === 'chat' || screen === 'detail' || screen === 'create');
  }, [screen, onScreenStateChange]);

  useEffect(() => {
    if (!token || !supabaseClient) return;
    let channel: RealtimeChannel | null = null;

    (async () => {
      try {
        const session = await ecobudApi.fetchRealtimeSession(token);
        if (!session.enabled || !session.channels?.userSwap) return;

        const connectedAt = Date.now();
        const seenRevisions: Record<string, number> = {};

        channel = supabaseClient
          .channel(session.channels.userSwap, {
            config: { broadcast: { ack: false, self: false } },
          })
          .on('broadcast', { event: 'swap' }, ({ payload }: any) => {
            const revision = payload?.revision;
            if (!revision || revision <= connectedAt) return;
            if (revision <= (seenRevisions['swap'] ?? 0)) return;
            seenRevisions['swap'] = revision;
            loadConversations();
            if (payload?.eventType === 'message' && payload?.swapRequestId) {
              DeviceEventEmitter.emit('swapChatChanged', String(payload.swapRequestId));
            }
          })
          .subscribe();
      } catch {
        // Supabase not configured or failed — silently ignore
      }
    })();

    return () => {
      if (channel && supabaseClient) {
        supabaseClient.removeChannel(channel);
      }
    };
  }, [token, loadConversations]);

  if (!token) return null;

  swapService.init(token);

  const handleSelectListing = (listing: SwapListing) => {
    setSelectedListing(listing);
    setScreen('detail');
  };

  const handleRequestSwap = (listing: SwapListing) => {
    setSelectedListing(listing);
    setShowSwapDialog(true);
  };

  const handleConfirmSwap = async (message: string) => {
    if (!selectedListing) return;
    try {
      await swapService.sendSwapRequest(selectedListing.id, currentUserId, message);
      setShowSwapDialog(false);
      await loadConversations();
      const convs = await swapService.fetchConversations(currentUserId);
      if (convs.length > 0) {
        setSelectedConversation(convs[0]);
        setScreen('chat');
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to send swap request';
      showNotification({ title: 'Request not sent', message: msg, tone: 'error' });
    }
  };

  const handleAcceptSwap = async () => {
    if (!selectedConversation) return;
    try {
      await swapService.updateSwapRequestStatus(selectedConversation.swapRequestId, 'accepted');
      setShowAcceptedDialog(true);
      await loadConversations();
    } catch (err: any) {
      console.error('Failed to accept swap:', err);
      showNotification({ title: 'Could not accept', message: err?.message || 'Failed to accept swap', tone: 'error' });
    }
  };

  const handleDeclineSwap = async () => {
    if (!selectedConversation) return;
    try {
      await swapService.updateSwapRequestStatus(selectedConversation.swapRequestId, 'declined');
      await loadConversations();
      showNotification({ title: 'Request declined', message: 'The requester has been notified.', tone: 'info' });
    } catch (err: any) {
      console.error('Failed to decline swap:', err);
      showNotification({ title: 'Could not decline', message: err?.message || 'Failed to decline swap', tone: 'error' });
    }
  };

  const handleMarkCompleted = async () => {
    if (!selectedConversation) return;
    try {
      await swapService.updateSwapRequestStatus(selectedConversation.swapRequestId, 'completed');
      await loadConversations();
      showNotification({ title: 'Exchange completed', message: 'The Give & Get exchange is now marked complete.', tone: 'success' });
    } catch (err: any) {
      console.error('Failed to mark as completed:', err);
      showNotification({ title: 'Could not complete exchange', message: err?.message || 'Failed to mark as completed', tone: 'error' });
    }
  };

  const handleDeleteListing = () => {
    setScreen('feed');
    setSelectedListing(null);
  };

  const handleReportListing = () => {
    if (!selectedListing) return;
    setShowReportDialog(true);
  };

  const isRootScreen = screen === 'feed';

  return (
    <View style={[localStyles.container, { backgroundColor: theme.colors.background }]}>
      <ConfirmDialog
        visible={showReportDialog}
        title="Report listing?"
        message={`This will send “${selectedListing?.title ?? 'this listing'}” to community moderators for review.`}
        confirmLabel="Report"
        destructive
        onCancel={() => setShowReportDialog(false)}
        onConfirm={() => {
          setShowReportDialog(false);
          showNotification({ title: 'Report submitted', message: 'Thank you. Our moderation team will review this listing.', tone: 'success' });
        }}
      />
      {isRootScreen && <TopNavbar model={model} />}

      {screen === 'feed' && (
        <ScreenTransition key={`feed-${feedTab}`}>
        <MarketplaceFeed
          currentUserId={currentUserId}
          onSelectListing={handleSelectListing}
          onCreateListing={() => setScreen('create')}
          onRequestSwap={handleRequestSwap}
          activeTab={feedTab}
          onTabChange={(tab) => {
            if (tab === feedTab) return;
            setFeedTab(tab);
            if (tab === 'chats') loadConversations(true);
          }}
          conversations={conversations}
          conversationsLoading={conversationsLoading}
          conversationsError={conversationsError}
          onRetryConversations={() => void loadConversations(true)}
          onSelectConversation={(conv) => {
            setSelectedConversation(conv);
            setScreen('chat');
          }}
          model={model}
        />
        </ScreenTransition>
      )}

      {screen === 'create' && (
        <ScreenTransition key="create">
        <CreateSwapListing
          userId={currentUserId}
          onBack={() => setScreen('feed')}
          onCreated={() => {
            setFeedTab('mylistings');
            setScreen('feed');
          }}
        />
        </ScreenTransition>
      )}

      {screen === 'detail' && selectedListing && (
        <ScreenTransition key={`detail-${selectedListing.id}`}>
        <SwapListingDetail
          listing={selectedListing}
          currentUserId={currentUserId}
          onBack={() => {
            setScreen('feed');
            setSelectedListing(null);
          }}
          onRequestSwap={() => setShowSwapDialog(true)}
          onDelete={handleDeleteListing}
          onReport={handleReportListing}
          onUpdated={(updated) => {
            setSelectedListing(updated);
          }}
        />
        </ScreenTransition>
      )}

      {screen === 'chat' && selectedConversation && (
        <ScreenTransition key={`chat-${selectedConversation.id}`}>
        <SwapChatView
          conversation={selectedConversation}
          currentUserId={currentUserId}
          onBack={() => {
            setScreen('feed');
            setFeedTab('chats');
            setSelectedConversation(null);
            loadConversations();
          }}
          onAcceptSwap={handleAcceptSwap}
          onDeclineSwap={handleDeclineSwap}
          onMarkCompleted={handleMarkCompleted}
        />
        </ScreenTransition>
      )}

      <SwapRequestDialog
        visible={showSwapDialog}
        listing={selectedListing}
        onClose={() => setShowSwapDialog(false)}
        onConfirm={handleConfirmSwap}
      />

      <SwapAcceptedDialog
        visible={showAcceptedDialog}
        listing={selectedListing || selectedConversation?.listing || null}
        meetupMethod={selectedListing?.meetupMethod || selectedConversation?.listing?.meetupMethod || 'public'}
        onClose={() => setShowAcceptedDialog(false)}
        onChat={() => {
          setShowAcceptedDialog(false);
          if (conversations.length > 0) {
            setSelectedConversation(conversations[0]);
            setScreen('chat');
          }
        }}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ecoTheme.colors.background,
  },
});


