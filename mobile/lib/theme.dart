import 'package:flutter/material.dart';

class AppPalette {
  static const bg = Color(0xFF0B132B);
  static const bg2 = Color(0xFF1C2541);
  static const surface = Color(0xFF1D2A4A);
  static const surface2 = Color(0xFF243057);
  static const text = Color(0xFFF5F7FB);
  static const muted = Color(0xFF8AA1C1);
  static const accent = Color(0xFF5BC0BE);
  static const accent2 = Color(0xFF3A86FF);
  static const gold = Color(0xFFFFD166);
  static const green = Color(0xFF2ECC71);
  static const red = Color(0xFFE63946);
  static const purple = Color(0xFFB06BFF);
  static const pink = Color(0xFFFF5C8A);
  static const border = Color(0x14FFFFFF);
}

ThemeData buildAppTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: AppPalette.bg,
    colorScheme: const ColorScheme.dark(
      primary: AppPalette.accent,
      secondary: AppPalette.accent2,
      surface: AppPalette.surface,
      onSurface: AppPalette.text,
      error: AppPalette.red,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppPalette.bg,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: AppPalette.text,
        fontWeight: FontWeight.w700,
        fontSize: 18,
      ),
      iconTheme: IconThemeData(color: AppPalette.text),
    ),
    cardTheme: const CardTheme(
      color: AppPalette.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
      ),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppPalette.bg2,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      labelStyle: const TextStyle(color: AppPalette.muted),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppPalette.accent,
        foregroundColor: AppPalette.bg,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppPalette.surface2,
        foregroundColor: AppPalette.text,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppPalette.text,
        side: const BorderSide(color: AppPalette.border),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppPalette.bg,
      selectedItemColor: AppPalette.accent,
      unselectedItemColor: AppPalette.muted,
      type: BottomNavigationBarType.fixed,
      showUnselectedLabels: true,
    ),
    dividerColor: AppPalette.border,
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: AppPalette.surface2,
      contentTextStyle: TextStyle(color: AppPalette.text),
      behavior: SnackBarBehavior.floating,
    ),
  );
}

Color rarityColor(String rarity) {
  switch (rarity) {
    case 'rare':
      return AppPalette.accent2;
    case 'epic':
      return AppPalette.purple;
    case 'legendary':
      return AppPalette.gold;
    case 'special':
      return AppPalette.pink;
    case 'common':
    default:
      return const Color(0xFFC0C5CE);
  }
}
