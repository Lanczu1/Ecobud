import 'dart:convert';
import 'dart:html' as html;

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const EcoBudWebApp());
}

class EcoBudPalette {
  static const pine = Color(0xFF0D4038);
  static const emerald = Color(0xFF147A68);
  static const mint = Color(0xFF84D9B0);
  static const mist = Color(0xFFE8F6EE);
  static const fog = Color(0xFFF5FBF7);
  static const border = Color(0xFFD6E5DC);
  static const text = Color(0xFF14231E);
  static const textMuted = Color(0xFF60736B);
  static const gold = Color(0xFFE1BA68);
  static const ocean = Color(0xFF0C6E7C);
}

class EcoBudWebApp extends StatelessWidget {
  const EcoBudWebApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = EcoBudPalette.emerald;
    final colorScheme = ColorScheme.fromSeed(seedColor: seed).copyWith(
      primary: seed,
      secondary: EcoBudPalette.mint,
      surface: Colors.white,
      onSurface: EcoBudPalette.text,
    );

    return MaterialApp(
      title: 'ECO-BUD',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: colorScheme,
        scaffoldBackgroundColor: EcoBudPalette.fog,
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: EcoBudPalette.emerald,
            foregroundColor: Colors.white,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: const TextStyle(
              fontWeight: FontWeight.w800,
              letterSpacing: 0.2,
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: EcoBudPalette.pine,
            side: const BorderSide(color: EcoBudPalette.border),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: const TextStyle(
              fontWeight: FontWeight.w700,
              letterSpacing: 0.1,
            ),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: EcoBudPalette.pine,
            textStyle: const TextStyle(
              fontWeight: FontWeight.w700,
              letterSpacing: 0.1,
            ),
          ),
        ),
      ),
      home: const EcoBudLandingPage(),
    );
  }
}

class TransparencyMetric {
  const TransparencyMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
    this.suffix = '',
  });

  final String label;
  final int value;
  final IconData icon;
  final Color accent;
  final String suffix;
}

class TransparencyLogEntry {
  const TransparencyLogEntry({
    required this.id,
    required this.user,
    required this.action,
    required this.points,
    required this.hash,
  });

  final String id;
  final String user;
  final String action;
  final int points;
  final String hash;
}

class EcoBudLandingPage extends StatefulWidget {
  const EcoBudLandingPage({super.key});

  @override
  State<EcoBudLandingPage> createState() => _EcoBudLandingPageState();
}

class _EcoBudLandingPageState extends State<EcoBudLandingPage> {
  final GlobalKey _heroKey = GlobalKey();
  final GlobalKey _transparencyKey = GlobalKey();


  bool _isLoading = true;
  bool _isActionLoading = false;
  String _actionMessage = 'Preparing your verified eco journey';
  List<TransparencyMetric> _metrics = const [];
  List<TransparencyLogEntry> _logs = const [];

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (!mounted) {
      return;
    }

    setState(() {
      _metrics = const [
        TransparencyMetric(
          label: 'Eco Actions Verified',
          value: 15420,
          icon: Icons.eco_rounded,
          accent: Color(0xFF2E7D32),
        ),
        TransparencyMetric(
          label: 'Rewards Issued',
          value: 450000,
          icon: Icons.emoji_events_rounded,
          accent: Color(0xFF1E88E5),
          suffix: ' pts',
        ),
        TransparencyMetric(
          label: 'Active Participants',
          value: 3200,
          icon: Icons.groups_2_rounded,
          accent: Color(0xFFEF6C00),
        ),
      ];

      _logs = const [
        TransparencyLogEntry(
          id: '1',
          user: 'EcoWarrior#A4F1',
          action: 'Used Reusable Bottle',
          points: 5,
          hash:
              '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        ),
        TransparencyLogEntry(
          id: '2',
          user: 'EcoWarrior#B2C9',
          action: 'Joined Beach Cleanup',
          points: 50,
          hash:
              '8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
        ),
        TransparencyLogEntry(
          id: '3',
          user: 'EcoWarrior#19XQ',
          action: 'Completed Composting Basics',
          points: 15,
          hash:
              '2b4c6d8e0f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3',
        ),
      ];

      _isLoading = false;
    });
  }

  void _scrollTo(GlobalKey key) {
    final targetContext = key.currentContext;
    if (targetContext == null) {
      return;
    }

    Scrollable.ensureVisible(
      targetContext,
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeInOutCubic,
    );
  }

  void _showDownloadMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Download links can be wired to the mobile build once the app store assets are ready.',
        ),
      ),
    );
  }

  Future<T> _runActionOverlay<T>(
    String message,
    Future<T> Function() action, {
    Duration minimumDuration = const Duration(milliseconds: 620),
  }) async {
    final startedAt = DateTime.now();
    if (mounted) {
      setState(() {
        _actionMessage = message;
        _isActionLoading = true;
      });
    }

    try {
      return await action();
    } finally {
      final elapsed = DateTime.now().difference(startedAt);
      final remaining = minimumDuration - elapsed;
      if (remaining > Duration.zero) {
        await Future<void>.delayed(remaining);
      }

      if (mounted) {
        setState(() {
          _isActionLoading = false;
        });
      }
    }
  }

  Future<void> _runQuickAction(
    String message,
    VoidCallback action, {
    Duration minimumDuration = const Duration(milliseconds: 480),
  }) async {
    await _runActionOverlay(
      message,
      () async {
        action();
      },
      minimumDuration: minimumDuration,
    );
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final horizontalPadding = width < 720 ? 20.0 : 32.0;

    return Scaffold(
      body: Stack(
        children: [
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFFF7FCF9),
                  Color(0xFFF0F8F3),
                  Color(0xFFF5FBF7),
                ],
              ),
            ),
            child: SizedBox.expand(),
          ),
          const _AmbientBackground(),
          SafeArea(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  _RevealOnBuild(
                    delay: const Duration(milliseconds: 60),
                    child: _TopNavigation(
                      horizontalPadding: horizontalPadding,
                      onHomeTap: () {
                        _runQuickAction(
                          'Returning to the EcoBud hero...',
                          () => _scrollTo(_heroKey),
                        );
                      },
                      onTransparencyTap: () {
                        _runQuickAction(
                          'Opening the transparency ledger...',
                          () => _scrollTo(_transparencyKey),
                        );
                      },
                      onAdminTap: () {
                        // Redirect to the new standalone Admin Portal
                        const adminUrl = 'http://localhost:3005';
                        html.window.open(adminUrl, '_blank');
                      },
                      onDownloadTap: () {
                        _runActionOverlay(
                          'Preparing the EcoBud download handoff...',
                          () async {
                            _showDownloadMessage();
                          },
                        );
                      },
                    ),
                  ),
                  Padding(
                    padding: EdgeInsets.fromLTRB(
                      horizontalPadding,
                      28,
                      horizontalPadding,
                      96,
                    ),
                    child: Column(
                      children: [
                        _RevealOnBuild(
                          delay: const Duration(milliseconds: 160),
                          beginOffset: const Offset(0, 0.08),
                          child: _HeroSection(
                            key: _heroKey,
                            onStartTap: () {
                              _runQuickAction(
                                'Starting your EcoBud journey...',
                                () => _scrollTo(_transparencyKey),
                              );
                            },
                            onSecondaryTap: () {
                              _runQuickAction(
                                'Opening transparency details...',
                                () => _scrollTo(_transparencyKey),
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 72),
                        _RevealOnBuild(
                          delay: const Duration(milliseconds: 280),
                          beginOffset: const Offset(0, 0.09),
                          child: _TransparencySection(
                            key: _transparencyKey,
                            isLoading: _isLoading,
                            metrics: _metrics,
                            logs: _logs,
                          ),
                        ),

                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          IgnorePointer(
            ignoring: !_isLoading,
            child: AnimatedOpacity(
              opacity: _isLoading ? 1 : 0,
              duration: const Duration(milliseconds: 420),
              curve: Curves.easeOutCubic,
              child: const _EcobudLoadingScreen(),
            ),
          ),
          IgnorePointer(
            ignoring: !_isActionLoading || _isLoading,
            child: AnimatedOpacity(
              opacity: _isActionLoading && !_isLoading ? 1 : 0,
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOutCubic,
              child: _EcobudLoadingScreen(
                message: _actionMessage,
                caption: 'Ecobud is handling your request.',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AmbientBackground extends StatelessWidget {
  const _AmbientBackground();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: const [
          Positioned(
            top: -120,
            left: -100,
            child: _DecorativeOrb(
              size: 300,
              colors: [Color(0x55BDEFD7), Color(0x00BDEFD7)],
            ),
          ),
          Positioned(
            top: 220,
            right: -70,
            child: _DecorativeOrb(
              size: 220,
              colors: [Color(0x44E0F5C8), Color(0x00E0F5C8)],
            ),
          ),
          Positioned(
            bottom: 160,
            left: -60,
            child: _DecorativeOrb(
              size: 260,
              colors: [Color(0x33B8E9F2), Color(0x00B8E9F2)],
            ),
          ),
        ],
      ),
    );
  }
}

class _RevealOnBuild extends StatefulWidget {
  const _RevealOnBuild({
    required this.child,
    this.delay = Duration.zero,
    this.beginOffset = const Offset(0, 0.06),
  });

  final Widget child;
  final Duration delay;
  final Offset beginOffset;

  @override
  State<_RevealOnBuild> createState() => _RevealOnBuildState();
}

class _RevealOnBuildState extends State<_RevealOnBuild>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 760),
  );

  late final Animation<double> _opacity = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOutCubic,
  );

  late final Animation<Offset> _slide = Tween<Offset>(
    begin: widget.beginOffset,
    end: Offset.zero,
  ).animate(
    CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
  );

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(widget.delay, () {
      if (mounted) {
        _controller.forward();
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _slide, child: widget.child),
    );
  }
}

class _DecorativeOrb extends StatelessWidget {
  const _DecorativeOrb({
    required this.size,
    required this.colors,
  });

  final double size;
  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: colors),
      ),
    );
  }
}

class _EcobudWordmark extends StatelessWidget {
  const _EcobudWordmark({
    this.light = false,
    this.large = false,
  });

  final bool light;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final badgeSize = large ? 58.0 : 42.0;
    final iconSize = large ? 30.0 : 22.0;
    final gap = large ? 14.0 : 10.0;
    final textColor = light ? Colors.white : EcoBudPalette.text;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: badgeSize,
          height: badgeSize,
          decoration: BoxDecoration(
            color: light ? Colors.white.withValues(alpha: 0.14) : Colors.white,
            borderRadius: BorderRadius.circular(badgeSize / 2),
            border: Border.all(
              color: light
                  ? Colors.white.withValues(alpha: 0.18)
                  : EcoBudPalette.border,
            ),
            boxShadow: light
                ? null
                : const [
                    BoxShadow(
                      color: Color(0x12000000),
                      blurRadius: 14,
                      offset: Offset(0, 8),
                    ),
                  ],
          ),
          child: Image.asset(
            'assets/logo.png',
            width: iconSize,
            height: iconSize,
            fit: BoxFit.contain,
          ),
        ),
        SizedBox(width: gap),
        Text(
          'ECOBUD',
          style: TextStyle(
            color: textColor,
            fontSize: large ? 34 : 24,
            fontWeight: FontWeight.w900,
            letterSpacing: large ? 1.4 : 0.8,
          ),
        ),
      ],
    );
  }
}

class _EcobudLoadingScreen extends StatefulWidget {
  const _EcobudLoadingScreen({
    this.message = 'Preparing your verified eco journey',
    this.caption = 'Please wait a moment while EcoBud gets ready.',
  });

  final String message;
  final String caption;

  @override
  State<_EcobudLoadingScreen> createState() => _EcobudLoadingScreenState();
}

class _EcobudLoadingScreenState extends State<_EcobudLoadingScreen>
    with TickerProviderStateMixin {
  late final AnimationController _spinController = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 6),
  )..repeat();

  late final AnimationController _pulseController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1900),
  )..repeat(reverse: true);

  late final Animation<double> _pulse = Tween<double>(
    begin: 0.96,
    end: 1.04,
  ).animate(
    CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
  );

  @override
  void dispose() {
    _spinController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: EcoBudPalette.pine,
      child: Stack(
        children: [
          const Positioned(
            top: -90,
            right: -30,
            child: _DecorativeOrb(
              size: 240,
              colors: [Color(0x33D3FFE9), Color(0x00D3FFE9)],
            ),
          ),
          const Positioned(
            bottom: -120,
            left: -80,
            child: _DecorativeOrb(
              size: 300,
              colors: [Color(0x22FFFFFF), Color(0x00FFFFFF)],
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ScaleTransition(
                  scale: _pulse,
                  child: SizedBox(
                    width: 170,
                    height: 170,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        RotationTransition(
                          turns: _spinController,
                          child: Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.18),
                                width: 1.4,
                              ),
                            ),
                            child: Align(
                              alignment: Alignment.topCenter,
                              child: Container(
                                width: 14,
                                height: 14,
                                margin: const EdgeInsets.only(top: 10),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFC8FFE7),
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Color(0x66C8FFE7),
                                      blurRadius: 18,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                        Container(
                          width: 126,
                          height: 126,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const RadialGradient(
                              colors: [
                                Color(0xFF1A9D79),
                                Color(0xFF0A2925),
                              ],
                            ),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x3317D4A0),
                                blurRadius: 38,
                                offset: Offset(0, 18),
                              ),
                            ],
                          ),
                          child: Image.asset(
                            'assets/logo.png',
                            width: 56,
                            height: 56,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                const _EcobudWordmark(light: true, large: true),
                const SizedBox(height: 10),
                Text(
                  widget.message,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.78),
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.15,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  widget.caption,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.6),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 24),
                const _EcobudCircleLoader(
                  size: 68,
                  iconSize: 24,
                  strokeWidth: 4.5,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EcobudCircleLoader extends StatelessWidget {
  const _EcobudCircleLoader({
    this.size = 56,
    this.iconSize = 20,
    this.strokeWidth = 4,
  });

  final double size;
  final double iconSize;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CircularProgressIndicator(
            strokeWidth: strokeWidth,
            backgroundColor: Colors.white.withValues(alpha: 0.12),
            valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFD8FFE8)),
          ),
          Container(
            width: size * 0.58,
            height: size * 0.58,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF154F46),
              border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x3319D4A2),
                  blurRadius: 18,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Image.asset(
              'assets/logo.png',
              width: iconSize,
              height: iconSize,
              fit: BoxFit.contain,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionActionOverlay extends StatelessWidget {
  const _SectionActionOverlay({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: EcoBudPalette.pine.withValues(alpha: 0.42),
        borderRadius: BorderRadius.circular(32),
      ),
      child: Center(
        child: Container(
          width: 280,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
          decoration: BoxDecoration(
            color: const Color(0xFF0E342E),
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 30,
                offset: Offset(0, 16),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _EcobudWordmark(light: true),
              const SizedBox(height: 16),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 18),
              const _EcobudCircleLoader(
                size: 58,
                iconSize: 20,
                strokeWidth: 4.2,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopNavigation extends StatelessWidget {
  const _TopNavigation({
    required this.horizontalPadding,
    required this.onHomeTap,
    required this.onTransparencyTap,
    required this.onAdminTap,
    required this.onDownloadTap,
  });

  final double horizontalPadding;
  final VoidCallback onHomeTap;
  final VoidCallback onTransparencyTap;
  final VoidCallback onAdminTap;
  final VoidCallback onDownloadTap;

  @override
  Widget build(BuildContext context) {
    final isCompact = MediaQuery.sizeOf(context).width < 860;

    const brand = _EcobudWordmark();

    final links = Wrap(
      alignment: WrapAlignment.center,
      spacing: 8,
      runSpacing: 8,
      children: [
        _NavButton(label: 'Home', onTap: onHomeTap),
        _NavButton(label: 'Transparency', onTap: onTransparencyTap),
        _NavButton(label: 'Admin', onTap: onAdminTap),
        _GradientButton(
          onPressed: onDownloadTap,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 18),
          child: const Text('Download App'),
        ),
      ],
    );

    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        horizontal: horizontalPadding,
        vertical: 18,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withValues(alpha: 0.90),
            const Color(0xFFF1FAF4).withValues(alpha: 0.92),
            const Color(0xFFE9F8F1).withValues(alpha: 0.86),
          ],
        ),
        border: const Border(
          bottom: BorderSide(color: Color(0x66D6E5DC)),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F0D4038),
            blurRadius: 30,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: isCompact
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                brand,
                const SizedBox(height: 16),
                links,
              ],
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                brand,
                links,
              ],
            ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        foregroundColor: EcoBudPalette.textMuted,
        textStyle: const TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 15,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      ),
      child: Text(label),
    );
  }
}

class _GradientButton extends StatefulWidget {
  const _GradientButton({
    required this.child,
    this.onPressed,
    this.padding = const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
  });

  final Widget child;
  final VoidCallback? onPressed;
  final EdgeInsetsGeometry padding;

  @override
  State<_GradientButton> createState() => _GradientButtonState();
}

class _GradientButtonState extends State<_GradientButton> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final disabled = widget.onPressed == null;

    return MouseRegion(
      cursor: disabled ? SystemMouseCursors.basic : SystemMouseCursors.click,
      onEnter: (_) {
        if (!disabled) {
          setState(() {
            _hovered = true;
          });
        }
      },
      onExit: (_) {
        if (_hovered) {
          setState(() {
            _hovered = false;
          });
        }
      },
      child: AnimatedScale(
        scale: _hovered ? 1.025 : 1,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        child: AnimatedOpacity(
          opacity: disabled ? 0.62 : 1,
          duration: const Duration(milliseconds: 180),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF0E5D52),
                  Color(0xFF169070),
                  Color(0xFF73CFAA),
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF169070).withValues(alpha: 0.26),
                  blurRadius: _hovered ? 28 : 22,
                  offset: const Offset(0, 14),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: widget.onPressed,
                borderRadius: BorderRadius.circular(20),
                child: Padding(
                  padding: widget.padding,
                  child: DefaultTextStyle(
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                    ),
                    child: IconTheme(
                      data: const IconThemeData(color: Colors.white),
                      child: widget.child,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroSection extends StatelessWidget {
  const _HeroSection({
    super.key,
    required this.onStartTap,
    required this.onSecondaryTap,
  });

  final VoidCallback onStartTap;
  final VoidCallback onSecondaryTap;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final titleStyle = TextStyle(
      color: EcoBudPalette.text,
      fontSize: width < 720 ? 40 : 56,
      height: 1.05,
      fontWeight: FontWeight.w900,
    );

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(width < 720 ? 28 : 40),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(40),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFF9FEFB),
            Color(0xFFEAF6EF),
            Color(0xFFDFF1E7),
          ],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.78)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x170D4038),
            blurRadius: 46,
            offset: Offset(0, 24),
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned(
            top: -38,
            right: -20,
            child: _DecorativeOrb(
              size: 190,
              colors: [Color(0x55C7F1DE), Color(0x00C7F1DE)],
            ),
          ),
          const Positioned(
            bottom: -82,
            left: -60,
            child: _DecorativeOrb(
              size: 250,
              colors: [Color(0x44D7EEE3), Color(0x00D7EEE3)],
            ),
          ),
          LayoutBuilder(
            builder: (context, constraints) {
              final isStacked = constraints.maxWidth < 960;

              final copy = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: EcoBudPalette.emerald.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Verified eco-action tracking for real-world impact',
                      style: TextStyle(
                        color: EcoBudPalette.emerald,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text('Learn, Act, and Earn Rewards', style: titleStyle),
                  const SizedBox(height: 22),
                  const Text(
                    'Discover sustainable habits, join challenges, and track your environmental impact with ECOBUD. Our blockchain-inspired ledger keeps every reward traceable and every action trustworthy.',
                    style: TextStyle(
                      color: EcoBudPalette.textMuted,
                      fontSize: 18,
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: 28),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      _GradientButton(
                        onPressed: onStartTap,
                        child: const Text('Start Your Eco Journey'),
                      ),
                      OutlinedButton(
                        onPressed: onSecondaryTap,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 24,
                            vertical: 20,
                          ),
                        ),
                        child: const Text('View Transparency'),
                      ),
                    ],
                  ),
                ],
              );

              final spotlight = Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF103C35),
                      Color(0xFF116457),
                      Color(0xFF17876E),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(28),
                  border:
                      Border.all(color: Colors.white.withValues(alpha: 0.10)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 22,
                          backgroundColor: Color(0x33FFFFFF),
                          child: Icon(
                            Icons.verified_user_rounded,
                            color: Colors.white,
                          ),
                        ),
                        SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            'Verified Eco Impact',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 24),
                    _SpotlightRow(
                      icon: Icons.hub_rounded,
                      title: 'Immutable action chain',
                      subtitle:
                          'Each entry links to the previous SHA-256 record.',
                    ),
                    SizedBox(height: 18),
                    _SpotlightRow(
                      icon: Icons.card_giftcard_rounded,
                      title: 'Transparent rewards',
                      subtitle: 'Points and achievements stay easy to audit.',
                    ),
                    SizedBox(height: 18),
                    _SpotlightRow(
                      icon: Icons.groups_rounded,
                      title: 'Community-ready',
                      subtitle:
                          'Daily challenges, events, and shared progress.',
                    ),
                  ],
                ),
              );

              if (isStacked) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    copy,
                    const SizedBox(height: 24),
                    spotlight,
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 6, child: copy),
                  const SizedBox(width: 24),
                  Expanded(flex: 5, child: spotlight),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _SpotlightRow extends StatelessWidget {
  const _SpotlightRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(icon, color: Colors.white),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.78),
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TransparencySection extends StatelessWidget {
  const _TransparencySection({
    super.key,
    required this.isLoading,
    required this.metrics,
    required this.logs,
  });

  final bool isLoading;
  final List<TransparencyMetric> metrics;
  final List<TransparencyLogEntry> logs;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(
              Icons.verified_user_rounded,
              color: EcoBudPalette.emerald,
              size: 34,
            ),
            SizedBox(width: 14),
            Expanded(
              child: Text(
                'Public Transparency Ledger',
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                  color: EcoBudPalette.text,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text(
          'Each eco-action is verified, timestamped, and chained into a tamper-resistant activity stream so the community can trust what gets rewarded.',
          style: TextStyle(
            color: EcoBudPalette.textMuted,
            fontSize: 17,
            height: 1.6,
          ),
        ),
        const SizedBox(height: 28),
        LayoutBuilder(
          builder: (context, constraints) {
            final maxWidth = constraints.maxWidth;
            final columns = maxWidth >= 1100
                ? 3
                : maxWidth >= 720
                    ? 2
                    : 1;

            return GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: metrics.length,
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: columns,
                crossAxisSpacing: 18,
                mainAxisSpacing: 18,
                childAspectRatio: columns == 1 ? 2.25 : 2.05,
              ),
              itemBuilder: (context, index) {
                final metric = metrics[index];
                return _MetricCard(metric: metric);
              },
            );
          },
        ),
        const SizedBox(height: 28),
        _LogsPanel(isLoading: isLoading, logs: logs),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.metric});

  final TransparencyMetric metric;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: EcoBudPalette.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x120D4038),
            blurRadius: 24,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: metric.accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(metric.icon, color: metric.accent, size: 28),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  metric.label,
                  style: const TextStyle(
                    color: EcoBudPalette.textMuted,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${_formatNumber(metric.value)}${metric.suffix}',
                  style: const TextStyle(
                    color: EcoBudPalette.text,
                    fontSize: 30,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LogsPanel extends StatelessWidget {
  const _LogsPanel({
    required this.isLoading,
    required this.logs,
  });

  final bool isLoading;
  final List<TransparencyLogEntry> logs;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.90),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: EcoBudPalette.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x120D4038),
            blurRadius: 28,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Latest Immutable Actions',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: EcoBudPalette.text,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Every entry includes an anonymized contributor, a rewarded action, and its linked SHA-256 record.',
              style: TextStyle(
                color: EcoBudPalette.textMuted,
                height: 1.6,
              ),
            ),
            const SizedBox(height: 22),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: isLoading
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 28),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  : LayoutBuilder(
                      builder: (context, constraints) {
                        if (constraints.maxWidth < 920) {
                          return Column(
                            children: logs
                                .map((log) => Padding(
                                      padding: const EdgeInsets.only(bottom: 14),
                                      child: _LogCard(log: log),
                                    ))
                                .toList(),
                          );
                        }

                        return SelectionArea(
                          child: Column(
                            children: [
                              const _LogsHeaderRow(),
                              const Divider(height: 24),
                              for (final log in logs) _LogTableRow(log: log),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LogsHeaderRow extends StatelessWidget {
  const _LogsHeaderRow();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Expanded(
          flex: 3,
          child: Text(
            'User (Anonymized)',
            style: _headerStyle,
          ),
        ),
        SizedBox(width: 16),
        Expanded(
          flex: 4,
          child: Text(
            'Action',
            style: _headerStyle,
          ),
        ),
        SizedBox(width: 16),
        Expanded(
          flex: 2,
          child: Text(
            'Points',
            style: _headerStyle,
          ),
        ),
        SizedBox(width: 16),
        Expanded(
          flex: 5,
          child: Text(
            'SHA-256 Hash Link',
            style: _headerStyle,
          ),
        ),
      ],
    );
  }
}

class _LogTableRow extends StatelessWidget {
  const _LogTableRow({required this.log});

  final TransparencyLogEntry log;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 3,
            child: Text(
              log.user,
              style: const TextStyle(
                color: Color(0xFF111827),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            flex: 4,
            child: Text(
              log.action,
              style: const TextStyle(color: Color(0xFF4B5563)),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            flex: 2,
            child: Text(
              '+${log.points}',
              style: const TextStyle(
                color: Color(0xFF2E7D32),
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            flex: 5,
            child: Tooltip(
              message: log.hash,
              child: Text(
                log.hash,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFF9CA3AF),
                  fontFamily: 'monospace',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LogCard extends StatelessWidget {
  const _LogCard({required this.log});

  final TransparencyLogEntry log;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  log.user,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF111827),
                  ),
                ),
              ),
              Text(
                '+${log.points} pts',
                style: const TextStyle(
                  color: Color(0xFF2E7D32),
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            log.action,
            style: const TextStyle(
              color: Color(0xFF4B5563),
              height: 1.5,
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'SHA-256 Hash',
            style: TextStyle(
              color: Color(0xFF6B7280),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          SelectionArea(
            child: Text(
              log.hash,
              style: const TextStyle(
                color: Color(0xFF9CA3AF),
                fontFamily: 'monospace',
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

const _headerStyle = TextStyle(
  color: Color(0xFF6B7280),
  fontWeight: FontWeight.w800,
  fontSize: 13,
);

String _formatNumber(int value) {
  final digits = value.toString();
  final buffer = StringBuffer();

  for (var i = 0; i < digits.length; i++) {
    buffer.write(digits[i]);
    final remainingDigits = digits.length - i - 1;
    if (remainingDigits > 0 && remainingDigits % 3 == 0) {
      buffer.write(',');
    }
  }

  return buffer.toString();
}