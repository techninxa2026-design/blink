import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'blink_api.dart';

/// Native gallery/camera capture connected to Blink's existing Moments API.
class CaptureScreen extends StatefulWidget {
  const CaptureScreen({super.key, required this.token});
  final String token;
  @override
  State<CaptureScreen> createState() => _CaptureScreenState();
}

class _CaptureScreenState extends State<CaptureScreen> {
  final picker = ImagePicker();
  final caption = TextEditingController();
  XFile? selected;
  bool uploading = false;
  String? error;

  Future<void> choose(ImageSource source, {bool video = false}) async {
    try {
      final file = video
          ? await picker.pickVideo(source: source)
          : await picker.pickImage(source: source, imageQuality: 90);
      if (file != null && mounted) setState(() { selected = file; error = null; });
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> publish() async {
    if (selected == null || uploading) return;
    setState(() { uploading = true; error = null; });
    try {
      final request = http.MultipartRequest('POST', Uri.parse('${BlinkApi.baseUrl}/moments/upload'))
        ..headers['Authorization'] = 'Bearer ${widget.token}'
        ..fields['caption'] = caption.text.trim()
        ..files.add(await http.MultipartFile.fromPath('file', selected!.path));
      final response = await http.Response.fromStream(await request.send().timeout(const Duration(minutes: 3)));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        var message = 'Upload failed (${response.statusCode})';
        try {
          final json = jsonDecode(response.body);
          if (json is Map && json['message'] != null) message = json['message'].toString();
        } catch (_) {}
        throw Exception(message);
      }
      if (!mounted) return;
      setState(() { selected = null; caption.clear(); });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Moment published')));
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  @override
  void dispose() { caption.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      Text('Capture a moment', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
      const SizedBox(height: 16),
      Container(
        height: 220,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(24),
        ),
        child: selected == null
          ? const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.camera_alt_outlined, size: 58),
              SizedBox(height: 12),
              Text('Choose a photo or video'),
            ])
          : Padding(padding: const EdgeInsets.all(16), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.check_circle, size: 48, color: Color(0xFFFB6C00)),
              const SizedBox(height: 12),
              Text(selected!.name, textAlign: TextAlign.center, maxLines: 3, overflow: TextOverflow.ellipsis),
            ])),
      ),
      const SizedBox(height: 18),
      Wrap(spacing: 8, runSpacing: 8, children: [
        OutlinedButton.icon(onPressed: uploading ? null : () => choose(ImageSource.camera), icon: const Icon(Icons.photo_camera), label: const Text('Take photo')),
        OutlinedButton.icon(onPressed: uploading ? null : () => choose(ImageSource.gallery), icon: const Icon(Icons.photo_library), label: const Text('Photo gallery')),
        OutlinedButton.icon(onPressed: uploading ? null : () => choose(ImageSource.camera, video: true), icon: const Icon(Icons.videocam), label: const Text('Record video')),
        OutlinedButton.icon(onPressed: uploading ? null : () => choose(ImageSource.gallery, video: true), icon: const Icon(Icons.video_library), label: const Text('Video gallery')),
      ]),
      const SizedBox(height: 18),
      TextField(controller: caption, maxLength: 500, maxLines: 3, decoration: const InputDecoration(labelText: 'Caption', hintText: 'What is happening?')),
      if (error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(error!, style: const TextStyle(color: Colors.red))),
      FilledButton.icon(
        onPressed: selected == null || uploading ? null : publish,
        icon: const Icon(Icons.send),
        label: Text(uploading ? 'Publishing...' : 'Publish moment'),
        style: FilledButton.styleFrom(backgroundColor: const Color(0xFFFB6C00), padding: const EdgeInsets.all(16)),
      ),
    ],
  );
}
