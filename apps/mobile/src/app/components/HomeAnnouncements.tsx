import React, { useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TouchableOpacity } from '../../shared/accessibility/primitives';
import { SimpleMarkdown } from '../../shared/ui/SimpleMarkdown';
import { useTheme } from '../../shared/theme/ecoTheme';
import { ecobudApiOrigin, type ResidentAnnouncement } from '../../shared/api/ecobudApi';
import { type EcoBudMobileModel } from '../types/home';
import { resolveMediaUrl, getCategoryDetails } from '../utils/appUtils';

const previewText = (text: string) =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const dateLabel = (item: ResidentAnnouncement) =>
  item.publishAt
    ? new Date(item.publishAt).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Manila',
      })
    : '';

export function HomeAnnouncements({ model }: { model: EcoBudMobileModel }) {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [selected, setSelected] = useState<ResidentAnnouncement | null>(null);
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const carouselWidth = Math.max(280, windowWidth - 40);

  const items = [...model.announcements]
    .filter(item => !item.expiresAt || new Date(item.expiresAt).getTime() > Date.now())
    .sort(
      (a, b) =>
        Number(b.priority === 'Important') - Number(a.priority === 'Important') ||
        new Date(b.publishAt || 0).getTime() - new Date(a.publishAt || 0).getTime()
    );

  if (!items.length) return null;

  const openAction = (item: ResidentAnnouncement) => {
    if (item.ctaType === 'Open External Link' && /^https?:\/\//i.test(item.ctaValue || '')) {
      void Linking.openURL(item.ctaValue!).catch(() => {});
      return;
    }
    setSelected(null);
    setShowAll(false);
    if (item.ctaType === 'View Learning Module' && item.ctaValue) void model.openLesson(item.ctaValue);
    else if (item.ctaType === 'View Eco Event') model.setActiveOverlay('events');
    else if (item.ctaType === 'View Rewards') model.setActiveOverlay('rewards');
    else if (item.ctaType === 'View Eco Challenge') {
      const challenge = model.challenges.find(entry => entry.id === item.ctaValue);
      if (challenge) model.openChallengeMission(challenge);
      else model.setActiveTab('challenges');
    }
  };

  const handleSelectAnnouncement = (item: ResidentAnnouncement) => {
    setSelectedImgIndex(0);
    setSelected(item);
  };

  const card = (item: ResidentAnnouncement) => {
    const images = item.images?.length ? item.images : item.image ? [item.image] : [];
    const coverUrl = images[0] ? resolveMediaUrl(images[0], ecobudApiOrigin) : null;
    const catDetails = getCategoryDetails(item.category);

    return (
      <TouchableOpacity
        key={item.id}
        accessibilityRole="button"
        accessibilityLabel={`Read announcement: ${item.title}`}
        onPress={() => handleSelectAnnouncement(item)}
        style={[
          s.card,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        {coverUrl ? (
          <View style={s.cardCoverWrapper}>
            <Image
              source={{ uri: coverUrl }}
              resizeMode="cover"
              style={s.cardCover}
            />
          </View>
        ) : null}

        <View style={s.cardBody}>
          <View style={s.metaRow}>
            <View style={s.metaBadges}>
              <View
                style={[
                  s.categoryBadge,
                  {
                    backgroundColor: theme.isDark ? 'rgba(52, 211, 153, 0.12)' : '#E8F5E9',
                    borderColor: theme.isDark ? '#233028' : '#C8E6C9',
                  },
                ]}
              >
                <Ionicons
                  name={catDetails.iconName}
                  size={12}
                  color={theme.colors.primary}
                />
                <Text style={[s.categoryBadgeText, { color: theme.colors.primary }]}>
                  {item.category || 'General'}
                </Text>
              </View>

              {item.priority === 'Important' && (
                <View
                  style={[
                    s.importantBadge,
                    {
                      backgroundColor: theme.isDark ? 'rgba(251, 191, 36, 0.15)' : '#FEF3C7',
                      borderColor: theme.isDark ? 'rgba(251, 191, 36, 0.3)' : '#FDE68A',
                    },
                  ]}
                >
                  <Ionicons
                    name="alert-circle"
                    size={12}
                    color={theme.isDark ? '#FBBF24' : '#B45309'}
                  />
                  <Text
                    style={[
                      s.importantBadgeText,
                      { color: theme.isDark ? '#FBBF24' : '#B45309' },
                    ]}
                  >
                    Important
                  </Text>
                </View>
              )}
            </View>

            <View style={s.dateRow}>
              <Ionicons name="calendar-outline" size={12} color={theme.colors.textMuted} />
              <Text style={[s.dateText, { color: theme.colors.textMuted }]}>
                {dateLabel(item)}
              </Text>
            </View>
          </View>

          <Text
            numberOfLines={2}
            style={[s.title, { color: theme.colors.textPrimary }]}
          >
            {item.title}
          </Text>

          <Text
            numberOfLines={2}
            style={[s.body, { color: theme.colors.textMuted }]}
          >
            {previewText(item.content)}
          </Text>

          <View style={s.cardFooter}>
            <Text style={[s.readText, { color: theme.colors.primary }]}>
              Read announcement
            </Text>
            <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const selectedImages = selected
    ? selected.images?.length
      ? selected.images
      : selected.image
      ? [selected.image]
      : []
    : [];

  return (
    <View style={s.section}>
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <Ionicons name="megaphone-outline" size={20} color={theme.colors.primary} />
          <Text style={[s.heading, { color: theme.colors.textPrimary }]}>
            Announcements
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setShowAll(true)}
          style={s.control}
        >
          <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 14 }}>
            View all
          </Text>
        </TouchableOpacity>
      </View>

      {card(items[0])}

      <Modal
        visible={showAll || !!selected}
        animationType="slide"
        onRequestClose={() => {
          setSelected(null);
          setShowAll(false);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          {/* Top Navigation Bar */}
          <View
            style={[
              s.topBar,
              {
                borderBottomColor: theme.colors.border,
                backgroundColor: theme.colors.background,
              },
            ]}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                selected && showAll ? 'Back to announcements' : 'Close announcements'
              }
              style={s.navButton}
              onPress={() => {
                if (selected && showAll) {
                  setSelected(null);
                } else {
                  setSelected(null);
                  setShowAll(false);
                }
              }}
            >
              <Ionicons
                name={selected && showAll ? 'arrow-back' : 'close'}
                size={22}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>

            <Text style={[s.navTitle, { color: theme.colors.textPrimary }]}>
              {selected ? 'Announcement' : 'Announcements'}
            </Text>

            <View
              style={[
                s.brandChip,
                {
                  backgroundColor: theme.isDark ? 'rgba(52, 211, 153, 0.12)' : '#E8F5E9',
                  borderColor: theme.isDark ? '#233028' : '#C8E6C9',
                },
              ]}
            >
              <Ionicons name="megaphone" size={11} color={theme.colors.primary} />
              <Text style={[s.brandChipText, { color: theme.colors.primary }]}>
                EcoBud
              </Text>
            </View>
          </View>

          {/* Modal Body */}
          <ScrollView
            contentContainerStyle={s.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {selected ? (
              <View style={s.detailContainer}>
                {/* Meta Row */}
                <View style={s.metaRow}>
                  <View style={s.metaBadges}>
                    <View
                      style={[
                        s.categoryBadge,
                        {
                          backgroundColor: theme.isDark
                            ? 'rgba(52, 211, 153, 0.12)'
                            : '#E8F5E9',
                          borderColor: theme.isDark ? '#233028' : '#C8E6C9',
                        },
                      ]}
                    >
                      <Ionicons
                        name={getCategoryDetails(selected.category).iconName}
                        size={12}
                        color={theme.colors.primary}
                      />
                      <Text
                        style={[s.categoryBadgeText, { color: theme.colors.primary }]}
                      >
                        {selected.category || 'General'}
                      </Text>
                    </View>

                    {selected.priority === 'Important' && (
                      <View
                        style={[
                          s.importantBadge,
                          {
                            backgroundColor: theme.isDark
                              ? 'rgba(251, 191, 36, 0.15)'
                              : '#FEF3C7',
                            borderColor: theme.isDark ? 'rgba(251, 191, 36, 0.3)' : '#FDE68A',
                          },
                        ]}
                      >
                        <Ionicons
                          name="alert-circle"
                          size={12}
                          color={theme.isDark ? '#FBBF24' : '#B45309'}
                        />
                        <Text
                          style={[
                            s.importantBadgeText,
                            { color: theme.isDark ? '#FBBF24' : '#B45309' },
                          ]}
                        >
                          Important
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={s.dateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={12}
                      color={theme.colors.textMuted}
                    />
                    <Text style={[s.dateText, { color: theme.colors.textMuted }]}>
                      {dateLabel(selected)}
                    </Text>
                  </View>
                </View>

                {/* Title */}
                <Text
                  style={[s.detailTitle, { color: theme.colors.textPrimary }]}
                >
                  {selected.title}
                </Text>

                {/* Images Gallery */}
                {selectedImages.length > 0 && (
                  <View style={s.galleryContainer}>
                    {selectedImages.length === 1 ? (
                      <View
                        style={[
                          s.singleImageWrapper,
                          { borderColor: theme.colors.border },
                        ]}
                      >
                        <Image
                          source={{
                            uri:
                              resolveMediaUrl(selectedImages[0], ecobudApiOrigin) ||
                              undefined,
                          }}
                          resizeMode="cover"
                          style={s.heroImage}
                        />
                      </View>
                    ) : (
                      <View style={s.carouselWrapper}>
                        <ScrollView
                          horizontal
                          pagingEnabled
                          showsHorizontalScrollIndicator={false}
                          onMomentumScrollEnd={e => {
                            const x = e.nativeEvent.contentOffset.x;
                            const idx = Math.round(x / carouselWidth);
                            setSelectedImgIndex(idx);
                          }}
                          style={{ width: carouselWidth }}
                        >
                          {selectedImages.map((url, idx) => (
                            <View
                              key={url + idx}
                              style={{ width: carouselWidth, height: carouselWidth * (9 / 16) }}
                            >
                              <Image
                                source={{
                                  uri:
                                    resolveMediaUrl(url, ecobudApiOrigin) || undefined,
                                }}
                                resizeMode="cover"
                                style={[
                                  s.heroImage,
                                  { borderColor: theme.colors.border },
                                ]}
                              />
                            </View>
                          ))}
                        </ScrollView>

                        {/* Image Counter Badge */}
                        <View style={s.imageCounterBadge}>
                          <Text style={s.imageCounterText}>
                            {selectedImgIndex + 1} / {selectedImages.length}
                          </Text>
                        </View>

                        {/* Dot Indicators */}
                        <View style={s.dotsContainer}>
                          {selectedImages.map((_, idx) => (
                            <View
                              key={idx}
                              style={[
                                s.dot,
                                {
                                  backgroundColor:
                                    idx === selectedImgIndex
                                      ? theme.colors.primary
                                      : theme.colors.border,
                                },
                                idx === selectedImgIndex && s.dotActive,
                              ]}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Markdown Content */}
                <View style={s.markdownContainer}>
                  <SimpleMarkdown
                    baseStyle={{
                      color: theme.colors.textPrimary,
                      fontSize: 15,
                      lineHeight: 24,
                    }}
                  >
                    {selected.content}
                  </SimpleMarkdown>
                </View>

                {/* Action CTA Button */}
                {selected.ctaLabel && selected.ctaType !== 'No Action' && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => openAction(selected)}
                    style={[
                      s.ctaButton,
                      {
                        backgroundColor: theme.colors.primary,
                        shadowColor: theme.colors.primary,
                      },
                    ]}
                  >
                    <Text style={s.ctaButtonText}>{selected.ctaLabel}</Text>
                    <Ionicons
                      name={
                        selected.ctaType === 'Open External Link'
                          ? 'open-outline'
                          : 'arrow-forward'
                      }
                      size={18}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={s.listContainer}>
                {items.map(card)}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontSize: 19,
    fontWeight: '800',
  },
  control: {
    minHeight: 40,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Feed Card Styles
  card: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  cardCoverWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
  },
  cardCover: {
    width: '100%',
    height: '100%',
  },
  cardBody: {
    padding: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  metaBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  importantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  importantBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  readText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Modal Styles
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  brandChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  detailContainer: {
    width: '100%',
  },
  listContainer: {
    width: '100%',
  },
  detailTitle: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 16,
  },

  // Gallery
  galleryContainer: {
    marginBottom: 16,
  },
  singleImageWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  carouselWrapper: {
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
  },
  imageCounterBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
  },

  // Content & CTA
  markdownContainer: {
    marginBottom: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 8,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
