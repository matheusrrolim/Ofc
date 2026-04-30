import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/tiles.dart';

class MarketTab extends StatefulWidget {
  const MarketTab({super.key});

  @override
  State<MarketTab> createState() => _MarketTabState();
}

class _MarketTabState extends State<MarketTab> {
  late Future<List<Listing>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Listing>> _load() => context.read<AppState>().api.market();
  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final myClubId = state.club?.id ?? '';
    final fmt = NumberFormat.decimalPattern();

    return RefreshIndicator(
      onRefresh: () async {
        _refresh();
        await _future;
      },
      child: FutureBuilder<List<Listing>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  snap.error.toString(),
                  style: const TextStyle(color: AppPalette.muted),
                ),
              ),
            );
          }
          final listings = snap.data!.where((l) => l.player != null).toList();
          if (listings.isEmpty) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(24),
              children: const [
                SizedBox(height: 80),
                Icon(Icons.shopping_cart_outlined,
                    color: AppPalette.muted, size: 40),
                SizedBox(height: 8),
                Text(
                  'No listings yet.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppPalette.muted),
                ),
              ],
            );
          }

          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
            children: [
              const SectionTitle('Marketplace'),
              for (final l in listings)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: PlayerTile(
                    player: l.player!,
                    trailing: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '⛁ ${fmt.format(l.price)}',
                          style: const TextStyle(
                            color: AppPalette.accent,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        l.sellerId == myClubId
                            ? OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppPalette.red,
                                  side: const BorderSide(color: AppPalette.red),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 6),
                                ),
                                onPressed: () => _cancel(l),
                                child: const Text('Cancel'),
                              )
                            : ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 6),
                                ),
                                onPressed: () => _buy(l),
                                child: const Text('Buy'),
                              ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _buy(Listing l) async {
    final state = context.read<AppState>();
    try {
      await state.api.buyListing(l.listingId);
      await state.refreshMe();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Purchased!')),
      );
      _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  Future<void> _cancel(Listing l) async {
    try {
      await context.read<AppState>().api.cancelListing(l.listingId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cancelled')),
      );
      _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }
}
