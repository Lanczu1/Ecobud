import React from 'react';
import { Text, View, StyleSheet, TextStyle, ViewStyle } from 'react-native';

/**
 * SimpleMarkdown — a lightweight Markdown renderer for React Native.
 *
 * Handles the subset used by the AI assistant:
 *   - **bold** text
 *   - ### / ## / # headings
 *   - - bullet lists
 *   - 1. numbered lists
 *   - Regular paragraphs
 *
 * No native modules or Node.js polyfills required.
 */

interface SimpleMarkdownProps {
  children: string;
  baseStyle?: TextStyle;
  headingStyle?: TextStyle;
  boldStyle?: TextStyle;
  bulletStyle?: ViewStyle;
  linkColor?: string;
}

// Parse inline **bold** and *italic* into <Text> fragments
function renderInline(line: string, baseStyle: TextStyle, boldStyle: TextStyle): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** first, then *italic* — order matters so ** isn't consumed as two *
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`t-${lastIndex}`} style={baseStyle}>
          {line.slice(lastIndex, match.index)}
        </Text>,
      );
    }

    if (match[1] !== undefined) {
      // **bold**
      parts.push(
        <Text key={`b-${match.index}`} style={[baseStyle, boldStyle]}>
          {match[1]}
        </Text>,
      );
    } else if (match[2] !== undefined) {
      // *italic*
      parts.push(
        <Text key={`i-${match.index}`} style={[baseStyle, { fontStyle: 'italic' }]}>
          {match[2]}
        </Text>,
      );
    }

    lastIndex = regex.lastIndex;
  }

  // Remaining text after the last match
  if (lastIndex < line.length) {
    parts.push(
      <Text key={`t-${lastIndex}`} style={baseStyle}>
        {line.slice(lastIndex)}
      </Text>,
    );
  }

  // If nothing matched, return the whole line as-is
  if (parts.length === 0) {
    parts.push(
      <Text key="plain" style={baseStyle}>
        {line}
      </Text>,
    );
  }

  return parts;
}

export function SimpleMarkdown({
  children,
  baseStyle = {},
  headingStyle = {},
  boldStyle = {},
  bulletStyle = {},
}: SimpleMarkdownProps) {
  const lines = children.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  const resolvedBase: TextStyle = { color: '#1A211D', fontSize: 14, lineHeight: 22, ...baseStyle };
  const resolvedBold: TextStyle = { fontWeight: '700', ...boldStyle };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip empty lines (just add a small spacer)
    if (trimmed === '') {
      elements.push(<View key={key++} style={{ height: 6 }} />);
      continue;
    }

    // --- Headings: ### / ## / # ---
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length; // 1, 2, or 3
      const headingFontSize = level === 1 ? 17 : level === 2 ? 16 : 15;
      const hStyle: TextStyle = {
        ...resolvedBase,
        fontSize: headingFontSize,
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 4,
        ...headingStyle,
      };
      elements.push(
        <Text key={key++} style={hStyle}>
          {renderInline(headingMatch[2], hStyle, resolvedBold)}
        </Text>,
      );
      continue;
    }

    // --- Bullet list items: - text ---
    const bulletMatch = trimmed.match(/^[-•]\s+(.*)$/);
    if (bulletMatch) {
      elements.push(
        <View key={key++} style={[localStyles.bulletRow, bulletStyle]}>
          <Text style={[resolvedBase, localStyles.bulletDot]}>{'•'}</Text>
          <Text style={[resolvedBase, localStyles.bulletText]}>
            {renderInline(bulletMatch[1], resolvedBase, resolvedBold)}
          </Text>
        </View>,
      );
      continue;
    }

    // --- Numbered list items: 1. text ---
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      elements.push(
        <View key={key++} style={[localStyles.bulletRow, bulletStyle]}>
          <Text style={[resolvedBase, localStyles.numberLabel]}>{numberedMatch[1]}.</Text>
          <Text style={[resolvedBase, localStyles.bulletText]}>
            {renderInline(numberedMatch[2], resolvedBase, resolvedBold)}
          </Text>
        </View>,
      );
      continue;
    }

    // --- Regular paragraph line ---
    elements.push(
      <Text key={key++} style={[resolvedBase, { marginBottom: 4 }]}>
        {renderInline(trimmed, resolvedBase, resolvedBold)}
      </Text>,
    );
  }

  return <View>{elements}</View>;
}

const localStyles = StyleSheet.create({
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 16,
    marginTop: 1,
  },
  numberLabel: {
    width: 22,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
  },
});
