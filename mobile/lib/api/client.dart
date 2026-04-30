// Thin HTTP client for the OFC backend.
//
// Override the base URL at build time:
//   flutter run --dart-define=OFC_API_BASE_URL=http://192.168.1.10:8080
//
// Defaults:
//   - Android emulator -> http://10.0.2.2:8080  (host loopback)
//   - everything else  -> http://localhost:8080
import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'models.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => message;
}

String _defaultBaseUrl() {
  const fromEnv = String.fromEnvironment('OFC_API_BASE_URL');
  if (fromEnv.isNotEmpty) return fromEnv;
  if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:8080';
  return 'http://localhost:8080';
}

class ApiClient {
  ApiClient({String? baseUrl, http.Client? httpClient})
      : baseUrl = baseUrl ?? _defaultBaseUrl(),
        _http = httpClient ?? http.Client();

  final String baseUrl;
  final http.Client _http;

  String? token;

  Map<String, String> _headers([Map<String, String>? extra]) {
    final h = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null && token!.isNotEmpty) {
      h['Authorization'] = 'Bearer $token';
    }
    if (extra != null) h.addAll(extra);
    return h;
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Object? body,
  }) async {
    final uri = Uri.parse('$baseUrl/api/v1$path');
    http.Response res;
    final encoded = body == null ? null : jsonEncode(body);
    switch (method) {
      case 'GET':
        res = await _http.get(uri, headers: _headers());
        break;
      case 'POST':
        res = await _http.post(uri, headers: _headers(), body: encoded);
        break;
      case 'PUT':
        res = await _http.put(uri, headers: _headers(), body: encoded);
        break;
      case 'PATCH':
        res = await _http.patch(uri, headers: _headers(), body: encoded);
        break;
      case 'DELETE':
        res = await _http.delete(uri, headers: _headers(), body: encoded);
        break;
      default:
        throw ArgumentError('unsupported method $method');
    }
    if (res.statusCode >= 400) {
      String msg = 'HTTP ${res.statusCode}';
      try {
        final body = jsonDecode(res.body);
        if (body is Map && body['error'] is String) {
          msg = body['error'] as String;
        }
      } catch (_) {}
      throw ApiException(res.statusCode, msg);
    }
    if (res.body.isEmpty) return null;
    return jsonDecode(res.body);
  }

  // --- Auth ---
  Future<AuthResponse> register({
    required String username,
    required String email,
    required String password,
    String? clubName,
  }) async {
    final body = await _request('POST', '/auth/register', body: {
      'username': username,
      'email': email,
      'password': password,
      if (clubName != null && clubName.isNotEmpty) 'clubName': clubName,
    });
    return AuthResponse.fromJson(body as Map<String, dynamic>);
  }

  Future<AuthResponse> login({
    required String email,
    required String password,
  }) async {
    final body = await _request('POST', '/auth/login', body: {
      'email': email,
      'password': password,
    });
    return AuthResponse.fromJson(body as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      await _request('POST', '/auth/logout');
    } catch (_) {/* idempotent */}
  }

  // --- Me / club / squad ---
  Future<({User user, Club club})> me() async {
    final body = await _request('GET', '/me') as Map<String, dynamic>;
    return (
      user: User.fromJson(body['user'] as Map<String, dynamic>),
      club: Club.fromJson(body['club'] as Map<String, dynamic>),
    );
  }

  Future<SquadResponse> squad(String clubId) async {
    final body = await _request('GET', '/clubs/$clubId/squad');
    return SquadResponse.fromJson(body as Map<String, dynamic>);
  }

  Future<List<Coach>> coaches(String clubId) async {
    final body = await _request('GET', '/clubs/$clubId/coaches') as List;
    return body
        .map((e) => Coach.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<Club> setCoach(String clubId, String coachId) async {
    final body = await _request('PUT', '/clubs/$clubId/coach', body: {
      'coachId': coachId,
    });
    return Club.fromJson(body as Map<String, dynamic>);
  }

  // --- Matches ---
  Future<MatchResult> quickMatch() async {
    final body = await _request('POST', '/matches/quick', body: {});
    return MatchResult.fromJson(body as Map<String, dynamic>);
  }

  Future<MatchResult> leagueMatch() async {
    final body = await _request('POST', '/matches/league', body: {});
    return MatchResult.fromJson(body as Map<String, dynamic>);
  }

  Future<List<MatchResult>> recentMatches(String clubId, {int limit = 10}) async {
    final body = await _request('GET', '/clubs/$clubId/matches?limit=$limit') as List;
    return body
        .map((e) => MatchResult.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  // --- League / missions ---
  Future<List<StandingRow>> standings() async {
    final body = await _request('GET', '/league') as List;
    return body
        .map((e) => StandingRow.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<List<Mission>> missions() async {
    final body = await _request('GET', '/missions') as List;
    return body
        .map((e) => Mission.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<Mission> claimMission(String id) async {
    final body = await _request('POST', '/missions/$id/claim');
    return Mission.fromJson(body as Map<String, dynamic>);
  }

  // --- Packs ---
  Future<List<Pack>> packs() async {
    final body = await _request('GET', '/packs') as List;
    return body
        .map((e) => Pack.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<PackOpenResult> openPack(String packId, String currency) async {
    final body = await _request('POST', '/packs/open', body: {
      'packId': packId,
      'currency': currency,
    });
    return PackOpenResult.fromJson(body as Map<String, dynamic>);
  }

  // --- Marketplace ---
  Future<List<Listing>> market() async {
    final body = await _request('GET', '/market') as List;
    return body
        .map((e) => Listing.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<void> createListing(String playerId, int price) async {
    await _request('POST', '/market', body: {
      'playerId': playerId,
      'price': price,
    });
  }

  Future<void> cancelListing(String listingId) async {
    await _request('DELETE', '/market/$listingId');
  }

  Future<void> buyListing(String listingId) async {
    await _request('POST', '/market/$listingId/buy');
  }
}
