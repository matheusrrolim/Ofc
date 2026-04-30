import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../theme.dart';
import 'home_tab.dart';
import 'match_tab.dart';
import 'market_tab.dart';
import 'packs_tab.dart';
import 'squad_tab.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  late final List<Widget> _tabs = const [
    HomeTab(),
    SquadTab(),
    MatchTab(),
    MarketTab(),
    PacksTab(),
  ];

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final user = state.user;
    final club = state.club;
    final fmt = NumberFormat.decimalPattern();

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 64,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              club?.name ?? '',
              style: const TextStyle(
                color: AppPalette.text,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (user != null)
              Text(
                '@${user.username} · ${user.division}',
                style: const TextStyle(
                  color: AppPalette.muted,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Row(
              children: [
                _Balance(
                  label: '⛁ ${fmt.format(user?.softCurrency ?? 0)}',
                  color: AppPalette.accent,
                ),
                const SizedBox(width: 6),
                _Balance(
                  label: '★ ${fmt.format(user?.premiumCurrency ?? 0)}',
                  color: AppPalette.gold,
                ),
              ],
            ),
          ),
        ],
      ),
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_filled), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.groups), label: 'Squad'),
          BottomNavigationBarItem(icon: Icon(Icons.sports_soccer), label: 'Match'),
          BottomNavigationBarItem(icon: Icon(Icons.shopping_cart), label: 'Market'),
          BottomNavigationBarItem(icon: Icon(Icons.card_giftcard), label: 'Packs'),
        ],
      ),
    );
  }
}

class _Balance extends StatelessWidget {
  const _Balance({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppPalette.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppPalette.border),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
      ),
    );
  }
}
