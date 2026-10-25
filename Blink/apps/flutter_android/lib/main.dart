import 'package:flutter/material.dart';

void main() => runApp(const BlinkApp());

class BlinkApp extends StatefulWidget {
  const BlinkApp({super.key});

  @override
  State<BlinkApp> createState() => _BlinkAppState();
}

class _BlinkAppState extends State<BlinkApp> {
  ThemeMode mode = ThemeMode.system;
  static const orange = Color(0xFFFB6C00);

  @override
  Widget build(BuildContext context) {
    ThemeData theme(Brightness brightness) {
      final dark = brightness == Brightness.dark;
      return ThemeData(
        useMaterial3: true,
        brightness: brightness,
        colorScheme: ColorScheme.fromSeed(seedColor: orange, brightness: brightness),
        scaffoldBackgroundColor: dark ? const Color(0xFF111111) : const Color(0xFFFFFAF6),
        cardColor: dark ? const Color(0xFF1C1C1C) : Colors.white,
        appBarTheme: const AppBarTheme(centerTitle: false),
      );
    }

    return MaterialApp(
      title: 'Blink',
      debugShowCheckedModeBanner: false,
      theme: theme(Brightness.light),
      darkTheme: theme(Brightness.dark),
      themeMode: mode,
      home: Scaffold(
        appBar: AppBar(
          title: const Text('Blink', style: TextStyle(fontWeight: FontWeight.bold, color: orange)),
          actions: [IconButton(
            tooltip: 'Toggle theme',
            onPressed: () => setState(() => mode = mode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark),
            icon: const Icon(Icons.brightness_6_outlined),
          )],
        ),
        body: const Center(child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Blink for Android\nFlutter migration workspace', textAlign: TextAlign.center),
        )),
      ),
    );
  }
}
