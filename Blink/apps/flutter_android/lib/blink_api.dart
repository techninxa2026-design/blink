import 'dart:convert';
import 'package:http/http.dart' as http;

/// Shared REST client for the existing Blink NestJS API.
/// Pass the token from the authenticated session to each request.
class BlinkApi {
  BlinkApi(this.token);
  final String token;
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL', defaultValue: 'http://10.0.2.2:3000',
  );

  Future<dynamic> request(String path, {String method = 'GET', Object? body}) async {
    final url = Uri.parse('$baseUrl${path.startsWith('/') ? path : '/$path'}');
    final headers = <String, String>{
      'Authorization': 'Bearer $token',
      if (body != null) 'Content-Type': 'application/json',
    };
    late http.Response response;
    switch (method) {
      case 'POST':
        response = await http.post(url, headers: headers, body: jsonEncode(body));
      case 'PATCH':
        response = await http.patch(url, headers: headers, body: jsonEncode(body));
      case 'PUT':
        response = await http.put(url, headers: headers, body: jsonEncode(body));
      case 'DELETE':
        response = await http.delete(url, headers: headers, body: body == null ? null : jsonEncode(body));
      default:
        response = await http.get(url, headers: headers);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      String message = 'Request failed (${response.statusCode})';
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map && decoded['message'] != null) {
          final value = decoded['message'];
          message = value is List ? value.join(', ') : value.toString();
        }
      } catch (_) {}
      throw Exception(message);
    }
    if (response.body.isEmpty) return null;
    return jsonDecode(response.body);
  }

  Future<dynamic> moments() => request('/moments');
  Future<dynamic> momentActivity(String id) => request('/moments/${Uri.encodeComponent(id)}/activity');
  Future<dynamic> reactMoment(String id, String emoji) => request('/moments/${Uri.encodeComponent(id)}/react', method: 'POST', body: {'emoji': emoji});
  Future<dynamic> commentMoment(String id, String text, {String? parentId}) => request('/moments/${Uri.encodeComponent(id)}/comments', method: 'POST', body: {'body': text, if (parentId != null) 'parentId': parentId});
  Future<dynamic> giftMoment(String id, int amount) => request('/moments/${Uri.encodeComponent(id)}/bp', method: 'POST', body: {'amount': amount});
  Future<dynamic> deleteMomentComment(String commentId) => request('/moments/comments/${Uri.encodeComponent(commentId)}', method: 'DELETE');

  Future<dynamic> reels({int skip = 0}) => request('/reels?skip=$skip');
  Future<dynamic> reelComments(String id) => request('/reels/${Uri.encodeComponent(id)}/comments');
  Future<dynamic> reactReel(String id, String emoji) => request('/reels/${Uri.encodeComponent(id)}/react', method: 'POST', body: {'emoji': emoji});
  Future<dynamic> commentReel(String id, String text, {String? parentId}) => request('/reels/${Uri.encodeComponent(id)}/comments', method: 'POST', body: {'body': text, if (parentId != null) 'parentId': parentId});
  Future<dynamic> recordReelView(String id) => request('/reels/${Uri.encodeComponent(id)}/view', method: 'POST');

  Future<dynamic> incomingHearts() => request('/hearts/incoming');
  Future<dynamic> sentHearts() => request('/hearts/sent');
}
