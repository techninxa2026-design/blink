import 'reels_screen.dart';
import 'inbox_screen.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:3000');
const blinkOrange = Color(0xFFFB6C00);

void main() => runApp(const BlinkApp());

class BlinkApp extends StatefulWidget {
  const BlinkApp({super.key});
  @override
  State<BlinkApp> createState() => _BlinkAppState();
}

class _BlinkAppState extends State<BlinkApp> {
  ThemeMode mode = ThemeMode.system;
  String? token;
  Map<String, dynamic>? user;
  int tab = 0;

  ThemeData buildTheme(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: ColorScheme.fromSeed(seedColor: blinkOrange, brightness: brightness),
      scaffoldBackgroundColor: dark ? const Color(0xFF111111) : const Color(0xFFFFFAF6),
      cardColor: dark ? const Color(0xFF1C1C1C) : Colors.white,
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }

  void signedIn(String jwt, Map<String, dynamic> profile) {
    setState(() { token = jwt; user = profile; tab = 0; });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Blink',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: mode,
      home: token == null
          ? AuthScreen(onSignedIn: signedIn)
          : Scaffold(
              appBar: AppBar(
                title: const Text('blink.', style: TextStyle(color: blinkOrange, fontWeight: FontWeight.w900, fontSize: 28)),
                actions: [
                  IconButton(tooltip: 'Toggle theme', icon: const Icon(Icons.brightness_6_outlined), onPressed: () => setState(() => mode = mode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark)),
                  IconButton(tooltip: 'Log out', icon: const Icon(Icons.logout), onPressed: () => setState(() { token = null; user = null; })),
                ],
              ),
              body: switch (tab) {
                0 => MomentsFeed(token: token!),
                1 => ReelsScreen(token: token!),
                2 => const Center(child: Text('Capture — next migration module')),
                3 => InboxScreen(token: token!),
                _ => Center(child: Text('Hello, ${user?['name'] ?? 'Blink user'}')),
              },
              bottomNavigationBar: NavigationBar(
                selectedIndex: tab,
                onDestinationSelected: (value) => setState(() => tab = value),
                destinations: const [
                  NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
                  NavigationDestination(icon: Icon(Icons.play_circle_outline), label: 'Reels'),
                  NavigationDestination(icon: Icon(Icons.add_circle_outline), label: 'Create'),
                  NavigationDestination(icon: Icon(Icons.chat_bubble_outline), label: 'Inbox'),
                  NavigationDestination(icon: Icon(Icons.person_outline), label: 'Profile'),
                ],
              ),
            ),
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.onSignedIn});
  final void Function(String, Map<String, dynamic>) onSignedIn;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final formKey = GlobalKey<FormState>();
  final name = TextEditingController();
  final email = TextEditingController();
  final phone = TextEditingController();
  final password = TextEditingController();
  bool register = false;
  bool busy = false;
  String? error;

  @override
  void dispose() { name.dispose(); email.dispose(); phone.dispose(); password.dispose(); super.dispose(); }

  Future<void> submit() async {
    if (!formKey.currentState!.validate()) return;
    setState(() { busy = true; error = null; });
    try {
      if (register) {
        final result = await http.post(Uri.parse('$apiBaseUrl/auth/register'), headers: {'Content-Type':'application/json'}, body: jsonEncode({
          'name': name.text.trim(), 'email': email.text.trim(), 'phoneNumber': phone.text.trim(), 'password': password.text,
        })).timeout(const Duration(seconds: 20));
        if (result.statusCode >= 400) throw Exception(_message(result.body));
      }
      final response = await http.post(Uri.parse('$apiBaseUrl/auth/login'), headers: {'Content-Type':'application/json'}, body: jsonEncode({
        'email': email.text.trim(), 'password': password.text,
      })).timeout(const Duration(seconds: 20));
      if (response.statusCode >= 400) throw Exception(_message(response.body));
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (!mounted) return;
      widget.onSignedIn(data['accessToken'] as String, Map<String, dynamic>.from(data['user'] as Map));
    } catch (e) {
      if (mounted) setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  String _message(String body) {
    try {
      final value = (jsonDecode(body) as Map)['message'];
      return value is List ? value.join(', ') : value.toString();
    } catch (_) { return 'Request failed'; }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: SafeArea(child: Center(child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: Form(
        key: formKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('blink.', textAlign: TextAlign.center, style: TextStyle(fontSize: 52, fontWeight: FontWeight.w900, color: blinkOrange)),
          const SizedBox(height: 12),
          Text(register ? 'Create your Blink account' : 'Welcome back to Blink', textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 30),
          if (register) ...[
            TextFormField(controller: name, decoration: const InputDecoration(labelText: 'Full name'), validator: (v) => (v ?? '').trim().length < 2 ? 'Enter your name' : null),
            const SizedBox(height: 12),
          ],
          TextFormField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email'), validator: (v) => (v ?? '').contains('@') ? null : 'Enter a valid email'),
          const SizedBox(height: 12),
          if (register) ...[
            TextFormField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone number'), validator: (v) => RegExp(r'^\+?[0-9]{10,15}$').hasMatch(v ?? '') ? null : 'Enter 10–15 digits'),
            const SizedBox(height: 12),
          ],
          TextFormField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password'), validator: (v) => (v ?? '').length < (register ? 8 : 1) ? 'Enter a valid password' : null),
          const SizedBox(height: 16),
          if (error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(error!, style: const TextStyle(color: Colors.red))),
          FilledButton(onPressed: busy ? null : submit, style: FilledButton.styleFrom(backgroundColor: blinkOrange, padding: const EdgeInsets.all(16)), child: Text(busy ? 'Please wait…' : register ? 'Create account' : 'Log in')),
          TextButton(onPressed: busy ? null : () => setState(() { register = !register; error = null; }), child: Text(register ? 'Already have an account? Log in' : 'New to Blink? Sign up')),
        ]),
      )),
    ))));
  }
}

class MomentsFeed extends StatefulWidget {
  const MomentsFeed({super.key, required this.token});
  final String token;
  @override
  State<MomentsFeed> createState() => _MomentsFeedState();
}

class _MomentsFeedState extends State<MomentsFeed> {
  late Future<List<dynamic>> feed;
  @override
  void initState() { super.initState(); refresh(); }
  void refresh() { feed = load(); }
  Future<List<dynamic>> load() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/moments'), headers: {'Authorization': 'Bearer ${widget.token}'}).timeout(const Duration(seconds: 20));
    if (response.statusCode >= 400) throw Exception('Unable to load Moments (${response.statusCode})');
    final data = jsonDecode(response.body);
    if (data is List) return data;
    if (data is Map && data['items'] is List) return data['items'] as List;
    return [];
  }

  String mediaUrl(String value) => value.startsWith('http') ? value : '$apiBaseUrl${value.startsWith('/') ? '' : '/'}$value';

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<dynamic>>(future: feed, builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
      if (snapshot.hasError) return Center(child: Text('${snapshot.error}'));
      final items = snapshot.data ?? [];
      return RefreshIndicator(onRefresh: () async { setState(refresh); await feed; }, child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Moments', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          if (items.isEmpty) const Padding(padding: EdgeInsets.all(36), child: Center(child: Text('No Moments yet'))),
          for (final raw in items)
            if (raw is Map) Card(clipBehavior: Clip.antiAlias, margin: const EdgeInsets.only(bottom: 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              ListTile(
                leading: const CircleAvatar(backgroundColor: blinkOrange, child: Icon(Icons.person, color: Colors.white)),
                title: Text((raw['sender'] is Map ? raw['sender']['name'] : null)?.toString() ?? 'Blink member'),
                subtitle: Text(raw['createdAt']?.toString() ?? ''),
              ),
              if (raw['mediaType'] == 'photo' && raw['mediaUrl'] is String)
                Image.network(mediaUrl(raw['mediaUrl'] as String), width: double.infinity, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox(height: 180, child: Center(child: Icon(Icons.broken_image_outlined)))),
              if (raw['mediaType'] == 'video') const SizedBox(height: 160, child: Center(child: Icon(Icons.play_circle_outline, size: 54))),
              Padding(padding: const EdgeInsets.all(16), child: Text(raw['caption']?.toString() ?? '')),
            ])),
        ],
      ));
    });
  }
}
