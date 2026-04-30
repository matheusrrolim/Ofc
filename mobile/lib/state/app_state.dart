// AppState owns auth + the cached user/club. Screens listen to it via
// `Provider<AppState>` and call `refreshMe()` after any mutation that
// touches balances or club state.
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/client.dart';
import '../api/models.dart';

const _kTokenKey = 'ofc_token';

class AppState extends ChangeNotifier {
  AppState({ApiClient? api}) : api = api ?? ApiClient();

  final ApiClient api;

  User? _user;
  Club? _club;
  bool _booting = true;

  User? get user => _user;
  Club? get club => _club;
  bool get booting => _booting;
  bool get isAuthenticated => _user != null && api.token != null && api.token!.isNotEmpty;

  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_kTokenKey);
    if (saved != null && saved.isNotEmpty) {
      api.token = saved;
      try {
        await refreshMe();
      } catch (_) {
        await _clearToken();
      }
    }
    _booting = false;
    notifyListeners();
  }

  Future<void> _persistToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kTokenKey, token);
  }

  Future<void> _clearToken() async {
    api.token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kTokenKey);
  }

  Future<void> register({
    required String username,
    required String email,
    required String password,
    String? clubName,
  }) async {
    final r = await api.register(
      username: username,
      email: email,
      password: password,
      clubName: clubName,
    );
    api.token = r.token;
    await _persistToken(r.token);
    _user = r.user;
    _club = r.club;
    notifyListeners();
  }

  Future<void> login({required String email, required String password}) async {
    final r = await api.login(email: email, password: password);
    api.token = r.token;
    await _persistToken(r.token);
    _user = r.user;
    _club = r.club;
    notifyListeners();
  }

  Future<void> logout() async {
    await api.logout();
    _user = null;
    _club = null;
    await _clearToken();
    notifyListeners();
  }

  Future<void> refreshMe() async {
    final r = await api.me();
    _user = r.user;
    _club = r.club;
    notifyListeners();
  }
}
