import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/auth_screen.dart';
import 'screens/home_shell.dart';
import 'screens/splash.dart';
import 'state/app_state.dart';
import 'theme.dart';

class OfcApp extends StatelessWidget {
  const OfcApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<AppState>(
      create: (_) => AppState()..bootstrap(),
      child: MaterialApp(
        title: 'OFC Manager',
        theme: buildAppTheme(),
        darkTheme: buildAppTheme(),
        themeMode: ThemeMode.dark,
        debugShowCheckedModeBanner: false,
        home: const _Root(),
      ),
    );
  }
}

class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    if (state.booting) return const SplashScreen();
    if (!state.isAuthenticated) return const AuthScreen();
    return const HomeShell();
  }
}
