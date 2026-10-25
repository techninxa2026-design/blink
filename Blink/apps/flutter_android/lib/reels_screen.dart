import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'blink_api.dart';

class ReelsScreen extends StatefulWidget {
  const ReelsScreen({super.key, required this.token});
  final String token;
  @override
  State<ReelsScreen> createState() => _ReelsScreenState();
}

class _ReelsScreenState extends State<ReelsScreen> {
  late final BlinkApi api = BlinkApi(widget.token);
  late Future<dynamic> feed = api.reels();
  Future<void> refresh() async { setState(() => feed = api.reels()); await feed; }
  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: feed,
    builder: (context, snapshot) {
      if (!snapshot.hasData) return Center(child: snapshot.hasError ? Text('${snapshot.error}') : const CircularProgressIndicator());
      final data = snapshot.data;
      final items = data is Map && data['items'] is List ? data['items'] as List : data is List ? data : <dynamic>[];
      if (items.isEmpty) return const Center(child: Text('No Reels available'));
      return PageView.builder(
        scrollDirection: Axis.vertical,
        itemCount: items.length,
        itemBuilder: (context, index) {
          final raw = items[index];
          if (raw is! Map) return const SizedBox.shrink();
          return ReelPlayer(key: ValueKey(raw['id']), api: api, reel: raw);
        },
      );
    },
  );
}

class ReelPlayer extends StatefulWidget {
  const ReelPlayer({super.key, required this.api, required this.reel});
  final BlinkApi api;
  final Map reel;
  @override
  State<ReelPlayer> createState() => _ReelPlayerState();
}

class _ReelPlayerState extends State<ReelPlayer> {
  VideoPlayerController? player;
  String? error;
  bool busy = false;
  @override
  void initState() { super.initState(); initialize(); }
  Future<void> initialize() async {
    try {
      final source = widget.reel['videoUrl']?.toString() ?? '';
      if (source.isEmpty) throw Exception('Video URL missing');
      final url = source.startsWith('http') ? source : '${BlinkApi.baseUrl}${source.startsWith('/') ? '' : '/'}$source';
      final controller = VideoPlayerController.networkUrl(Uri.parse(url));
      player = controller;
      await controller.initialize();
      await controller.setLooping(true);
      await controller.play();
      if (mounted) setState(() {});
      final id = widget.reel['id']?.toString();
      if (id != null) await widget.api.recordReelView(id);
    } catch (e) { if (mounted) setState(() => error = '$e'); }
  }
  Future<void> react(String emoji) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await widget.api.reactReel(widget.reel['id'].toString(), emoji);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Reaction: $emoji')));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'))); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  void dispose() { player?.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final controller = player;
    final author = widget.reel['author'];
    return Stack(fit: StackFit.expand, children: [
      Container(color: Colors.black, child: error != null
        ? Center(child: Text(error!, style: const TextStyle(color: Colors.white)))
        : controller == null || !controller.value.isInitialized
          ? const Center(child: CircularProgressIndicator())
          : GestureDetector(
              onTap: () => setState(() => controller.value.isPlaying ? controller.pause() : controller.play()),
              child: FittedBox(fit: BoxFit.cover, child: SizedBox(width: controller.value.size.width, height: controller.value.size.height, child: VideoPlayer(controller))),
            )),
      Positioned(left: 16, right: 78, bottom: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(author is Map ? author['name']?.toString() ?? 'Creator' : 'Creator', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        const SizedBox(height: 8),
        Text(widget.reel['caption']?.toString() ?? '', style: const TextStyle(color: Colors.white)),
      ])),
      Positioned(right: 8, bottom: 30, child: Column(children: [
        IconButton(onPressed: () => react('❤️'), icon: const Icon(Icons.favorite, color: Colors.white, size: 32)),
        Text('${widget.reel['reactionCount'] ?? 0}', style: const TextStyle(color: Colors.white)),
        IconButton(onPressed: () => showModalBottomSheet(context: context, isScrollControlled: true, builder: (_) => ReelComments(api: widget.api, id: widget.reel['id'].toString())), icon: const Icon(Icons.chat_bubble, color: Colors.white, size: 32)),
        Text('${widget.reel['commentCount'] ?? 0}', style: const TextStyle(color: Colors.white)),
      ])),
    ]);
  }
}

class ReelComments extends StatefulWidget {
  const ReelComments({super.key, required this.api, required this.id});
  final BlinkApi api;
  final String id;
  @override
  State<ReelComments> createState() => _ReelCommentsState();
}

class _ReelCommentsState extends State<ReelComments> {
  final draft = TextEditingController();
  late Future<dynamic> comments = widget.api.reelComments(widget.id);
  bool busy = false;
  Future<void> send() async {
    if (draft.text.trim().isEmpty || busy) return;
    setState(() => busy = true);
    try {
      await widget.api.commentReel(widget.id, draft.text.trim());
      draft.clear();
      setState(() => comments = widget.api.reelComments(widget.id));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override
  void dispose() { draft.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => SafeArea(child: Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: SizedBox(height: MediaQuery.sizeOf(context).height * .65, child: Column(children: [
      const ListTile(title: Text('Comments')),
      Expanded(child: FutureBuilder<dynamic>(future: comments, builder: (context, snapshot) {
        if (!snapshot.hasData) return Center(child: snapshot.hasError ? Text('${snapshot.error}') : const CircularProgressIndicator());
        final data = snapshot.data;
        final list = data is List ? data : <dynamic>[];
        return ListView.builder(itemCount: list.length, itemBuilder: (context, index) {
          final item = list[index];
          return ListTile(title: Text(item is Map ? item['author'] is Map ? item['author']['name']?.toString() ?? 'Member' : 'Member' : 'Member'), subtitle: Text(item is Map ? item['body']?.toString() ?? '' : ''));
        });
      })),
      Row(children: [
        Expanded(child: TextField(controller: draft, decoration: const InputDecoration(hintText: 'Write a comment'))),
        IconButton(onPressed: busy ? null : send, icon: const Icon(Icons.send)),
      ]),
    ])),
  ));
}
