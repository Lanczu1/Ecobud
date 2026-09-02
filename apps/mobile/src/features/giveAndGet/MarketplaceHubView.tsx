import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
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
  const [screen, setScreen] = useState<HubScreen>('feed');
  const [feedTab, setFeedTab] = useState<FeedTab>('browse');
  const [selectedListing, setSelectedListing] = useState<SwapListing | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<SwapConversation | null>(null);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [showAcceptedDialog, setShowAcceptedDialog] = useState(false);
  const [conversations, setConversations] = useState<SwapConversation[]>([]);

  const currentUserId = model.session?.user.id || '';
  const token = model.session?.token || '';

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const convs = await swapService.fetchConversations(currentUserId);
      setConversations(convs);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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
      Alert.alert('Error', msg);
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
      Alert.alert('Error', err?.message || 'Failed to accept swap');
    }
  };

  const handleDeclineSwap = async () => {
    if (!selectedConversation) return;
    try {
      await swapService.updateSwapRequestStatus(selectedConversation.swapRequestId, 'declined');
      await loadConversations();
    } catch (err: any) {
      console.error('Failed to decline swap:', err);
      Alert.alert('Error', err?.message || 'Failed to decline swap');
    }
  };

  const handleMarkCompleted = async () => {
    if (!selectedConversation) return;
    try {
      await swapService.updateSwapRequestStatus(selectedConversation.swapRequestId, 'completed');
      await loadConversations();
    } catch (err: any) {
      console.error('Failed to mark as completed:', err);
      Alert.alert('Error', err?.message || 'Failed to mark as completed');
    }
  };

  const handleDeleteListing = () => {
    setScreen('feed');
    setSelectedListing(null);
  };

  const handleReportListing = () => {
    if (!selectedListing) return;
    Alert.alert(
      'Report Listing',
      `Are you sure you want to report "${selectedListing.title}" for review by community moderators?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Report Submitted', 'Thank you for keeping our community safe. Our moderation team will review this listing.');
          },
        },
      ]
    );
  };

  const isRootScreen = screen === 'feed';

  return (
    <View style={[localStyles.container, { backgroundColor: theme.colors.background }]}>
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
            setFeedTab(tab);
            if (tab === 'chats') loadConversations();
          }}
          conversations={conversations}
          onSelectConversation={(conv) => {
            setSelectedConversation(conv);
            setScreen('chat');
          }}
          onRefreshConversations={loadConversations}
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
