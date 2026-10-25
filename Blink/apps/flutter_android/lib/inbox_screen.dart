import 'package:flutter/material.dart';
import 'blink_api.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key, required this.token});
  final String token;
  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  late final BlinkApi api = BlinkApi(widget.token);
  late Future<dynamic> conversations = api.request('/inbox');
  Future<void> reload() async {
    setState(() => conversations = api.request('/inbox'));
    await conversations;
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: conversations,
    builder: (context, snapshot) {
      if (!snapshot.hasData) {
        if (snapshot.hasError) return Center(child: Text('Inbox: ${snapshot.error}'));
        return const Center(child: CircularProgressIndicator());
      }
      final data = snapshot.data;
      final items = data is List ? data : data is Map && data['items'] is List ? data['items'] as List : <dynamic>[];
      return RefreshIndicator(
        onRefresh: reload,
        child: ListView(children: [
          Padding(padding: const EdgeInsets.all(16), child: Text('Inbox', style: Theme.of(context).textTheme.headlineMedium)),
          if (items.isEmpty) const ListTile(title: Text('No conversations yet')),
          for (final item in items)
            if (item is Map)
              ListTile(
                leading: const CircleAvatar(child: Icon(Icons.person_outline)),
                title: Text(item['groupName']?.toString() ?? (item['otherUser'] is Map ? item['otherUser']['name']?.toString() : null) ?? 'Conversation'),
                subtitle: Text(item['lastMessage'] is Map ? item['lastMessage']['body']?.toString() ?? 'Media message' : 'Open conversation'),
                trailing: (item['unreadCount'] is num && item['unreadCount'] > 0) ? Badge(label: Text('${item['unreadCount']}')) : const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ConversationScreen(api: api, id: item['id'].toString()))).then((_) => reload()),
              ),
        ]),
      );
    },
  );
}

class ConversationScreen extends StatefulWidget {
  const ConversationScreen({super.key, required this.api, required this.id});
  final BlinkApi api;
  final String id;
  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final draft = TextEditingController();
  late Future<dynamic> detail = load();
  bool sending = false;
  Future<dynamic> load() async {
    final value = await widget.api.request('/inbox/conversations/${Uri.encodeComponent(widget.id)}');
    await widget.api.request('/inbox/conversations/${Uri.encodeComponent(widget.id)}/read', method: 'POST');
    return value;
  }
  Future<void> send() async {
    final text = draft.text.trim();
    if (text.isEmpty || sending) return;
    setState(() => sending = true);
    try {
      await widget.api.request('/inbox/conversations/${Uri.encodeComponent(widget.id)}/messages', method: 'POST', body: {'body': text});
      draft.clear();
      setState(() => detail = load());
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }
  @override
  void dispose() { draft.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Conversation')),
    body: Column(children: [
      Expanded(child: FutureBuilder<dynamic>(future: detail, builder: (context, snapshot) {
        if (!snapshot.hasData) return Center(child: snapshot.hasError ? Text('${snapshot.error}') : const CircularProgressIndicator());
        final data = snapshot.data;
        final messages = data is Map && data['messages'] is List ? data['messages'] as List : <dynamic>[];
        return RefreshIndicator(
          onRefresh: () async { setState(() => detail = load()); await detail; },
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: messages.length,
            itemBuilder: (context, index) {
              final msg = messages[index];
              if (msg is! Map) return const SizedBox.shrink();
              return Card(child: ListTile(
                title: Text(msg['body']?.toString() ?? (msg['mediaType'] == null ? 'Message' : 'Media: ${msg['mediaType']}')),
                subtitle: Text(msg['createdAt']?.toString() ?? ''),
              ));
            },
          ),
        );
      })),
      SafeArea(child: Padding(padding: const EdgeInsets.all(8), child: Row(children: [
        Expanded(child: TextField(controller: draft, minLines: 1, maxLines: 4, decoration: const InputDecoration(hintText: 'Message...'))),
        IconButton(onPressed: sending ? null : send, icon: const Icon(Icons.send, color: Color(0xFFFB6C00))),
      ]))),
    ]),
  );
}
