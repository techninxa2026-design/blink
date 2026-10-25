import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'blink_api.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.token});
  final String token;
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final api = BlinkApi(widget.token);
  late Future<dynamic> profile = api.request('/profile/me');
  bool busy = false;

  void reload() => setState(() => profile = api.request('/profile/me'));

  Future<void> upload(String field) async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (file == null) return;
    setState(() => busy = true);
    try {
      final req = http.MultipartRequest('POST', Uri.parse('${BlinkApi.baseUrl}/profile/me/$field'))
        ..headers['Authorization'] = 'Bearer ${widget.token}'
        ..files.add(await http.MultipartFile.fromPath('file', file.path));
      final response = await http.Response.fromStream(await req.send());
      if (response.statusCode >= 300) throw Exception('Upload failed: ${response.statusCode}');
      reload();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> edit(Map profile) async {
    final fields = ['name', 'bio', 'college', 'highSchool', 'occupation', 'workplace'];
    final controllers = {for (final f in fields) f: TextEditingController(text: profile[f]?.toString() ?? '')};
    try {
      final saved = await showDialog<Map<String, String>>(context: context, builder: (context) => AlertDialog(
        title: const Text('Edit profile'),
        content: SizedBox(width: 440, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          for (final field in fields) Padding(padding: const EdgeInsets.only(bottom: 12), child: TextField(
            controller: controllers[field],
            maxLines: field == 'bio' ? 3 : 1,
            decoration: InputDecoration(labelText: field),
          )),
        ]))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, {for (final f in fields) f: controllers[f]!.text.trim()}), child: const Text('Save')),
        ],
      ));
      if (saved == null) return;
      setState(() => busy = true);
      try {
        await api.request('/profile/me', method: 'PATCH', body: saved);
        reload();
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      } finally {
        if (mounted) setState(() => busy = false);
      }
    } finally {
      for (final c in controllers.values) { c.dispose(); }
    }
  }

  String? mediaUrl(dynamic key) {
    if (key == null || key.toString().isEmpty) return null;
    final text = key.toString();
    return text.startsWith('http') ? text : '${BlinkApi.baseUrl}/uploads/${Uri.encodeComponent(text)}';
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: profile,
    builder: (context, snapshot) {
      if (!snapshot.hasData) return Center(child: snapshot.hasError ? Text('${snapshot.error}') : const CircularProgressIndicator());
      final p = snapshot.data;
      if (p is! Map) return const Center(child: Text('Profile unavailable'));
      final avatar = mediaUrl(p['avatarKey']);
      final cover = mediaUrl(p['coverKey']);
      return RefreshIndicator(
        onRefresh: () async { reload(); await profile; },
        child: ListView(children: [
          SizedBox(height: 180, child: Stack(fit: StackFit.expand, children: [
            cover == null ? Container(color: const Color(0xFFFFD6B5)) : Image.network(cover, fit: BoxFit.cover),
            Positioned(right: 12, bottom: 8, child: IconButton.filledTonal(onPressed: busy ? null : () => upload('cover'), icon: const Icon(Icons.photo_camera))),
          ])),
          Transform.translate(offset: const Offset(0, -30), child: Column(children: [
            CircleAvatar(radius: 49, backgroundImage: avatar == null ? null : NetworkImage(avatar), child: avatar == null ? const Icon(Icons.person, size: 42) : null),
            TextButton.icon(onPressed: busy ? null : () => upload('avatar'), icon: const Icon(Icons.camera_alt), label: const Text('Change photo')),
            Text(p['name']?.toString() ?? 'Blink member', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(p['bio']?.toString() ?? ''),
            const SizedBox(height: 14),
            FilledButton.icon(onPressed: busy ? null : () => edit(p), icon: const Icon(Icons.edit), label: const Text('Edit profile')),
          ])),
          for (final field in ['college', 'highSchool', 'occupation', 'workplace'])
            if ((p[field]?.toString() ?? '').isNotEmpty)
              ListTile(leading: const Icon(Icons.info_outline), title: Text(field), subtitle: Text(p[field].toString())),
        ]),
      );
    },
  );
}
