import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:intl/intl.dart';
import 'package:sea_days/sea_day_credit.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load();

  final useMockBackend = _envBool('USE_MOCK_BACKEND');
  if (!useMockBackend) {
    await Supabase.initialize(
      url: dotenv.env['SUPABASE_URL']!,
      anonKey: dotenv.env['SUPABASE_PUBLISHABLE_KEY']!,
    );
  }

  runApp(SeaDaysApp(useMockBackend: useMockBackend));
}

bool _envBool(String key) {
  return (dotenv.env[key] ?? '').toLowerCase() == 'true';
}

SupabaseClient get supabase => Supabase.instance.client;

class SeaDaysApp extends StatelessWidget {
  const SeaDaysApp({
    required this.useMockBackend,
    super.key,
  });

  final bool useMockBackend;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'SeaDays',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF156C75),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: useMockBackend
          ? SeaDaysHomePage(
              repository: MockSeaDaysRepository(),
              backendLabel: 'Local mock',
            )
          : AuthGate(repository: SupabaseSeaDaysRepository()),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({
    required this.repository,
    super.key,
  });

  final SupabaseSeaDaysRepository repository;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: supabase.auth.onAuthStateChange,
      builder: (context, snapshot) {
        final session = supabase.auth.currentSession;

        if (session == null) {
          return AuthPage(repository: repository);
        }

        return SeaDaysHomePage(
          repository: repository,
          backendLabel: 'Supabase',
          onSignOut: repository.signOut,
        );
      },
    );
  }
}

class AuthPage extends StatefulWidget {
  const AuthPage({
    required this.repository,
    super.key,
  });

  final SupabaseSeaDaysRepository repository;

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSignUp = false;
  bool _isLoading = false;
  String? _message;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            margin: const EdgeInsets.all(16),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'SeaDays',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      controller: _emailController,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      validator: _required,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _passwordController,
                      decoration: const InputDecoration(
                        labelText: 'Password',
                        border: OutlineInputBorder(),
                      ),
                      obscureText: true,
                      autofillHints: const [AutofillHints.password],
                      validator: _passwordValidator,
                    ),
                    if (_message != null) ...[
                      const SizedBox(height: 12),
                      Text(_message!),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _isLoading ? null : _submit,
                      child: Text(_isSignUp ? 'Create account' : 'Sign in'),
                    ),
                    TextButton(
                      onPressed: _isLoading
                          ? null
                          : () => setState(() => _isSignUp = !_isSignUp),
                      child: Text(
                        _isSignUp
                            ? 'Use an existing account'
                            : 'Create a new account',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
      _message = null;
    });

    try {
      final email = _emailController.text.trim();
      final password = _passwordController.text;

      if (_isSignUp) {
        final hasSession = await widget.repository.signUp(email, password);
        if (!hasSession && mounted) {
          setState(() {
            _message =
                'Account created. Check email if confirmation is enabled.';
          });
        }
      } else {
        await widget.repository.signIn(email, password);
      }
    } on AuthException catch (error) {
      setState(() => _message = error.message);
    } catch (_) {
      setState(() => _message = 'Authentication failed.');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String? _required(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Required';
    }
    return null;
  }

  String? _passwordValidator(String? value) {
    if (value == null || value.length < 6) {
      return 'Use at least 6 characters';
    }
    return null;
  }
}

enum WatersCategory {
  inland('Inland', 'inland'),
  nearCoastal('Near coastal', 'near_coastal'),
  offshore('Offshore', 'offshore'),
  unknown('Unknown', 'unknown');

  const WatersCategory(this.label, this.dbValue);

  final String label;
  final String dbValue;

  static WatersCategory fromDb(String? value) {
    return WatersCategory.values.firstWhere(
      (waters) => waters.dbValue == value,
      orElse: () => WatersCategory.unknown,
    );
  }
}

class SeaServiceEntry {
  SeaServiceEntry({
    required this.id,
    required this.vesselName,
    required this.serviceDate,
    required this.durationHours,
    required this.creditedDays,
    required this.waters,
    required this.role,
    required this.routeDescription,
  });

  factory SeaServiceEntry.fromCreditRow(Map<String, dynamic> row) {
    return SeaServiceEntry(
      id: row['id'] as String,
      vesselName: row['vessel_name'] as String? ?? 'Unnamed vessel',
      serviceDate: DateTime.parse(row['service_date'] as String),
      durationHours: (row['duration_hours'] as num).toDouble(),
      creditedDays: (row['credited_days'] as num).toDouble(),
      waters: WatersCategory.fromDb(row['waters'] as String?),
      role: row['role'] as String? ?? '',
      routeDescription: row['route_description'] as String? ?? '',
    );
  }

  final String id;
  final String vesselName;
  final DateTime serviceDate;
  final double durationHours;
  final double creditedDays;
  final WatersCategory waters;
  final String role;
  final String routeDescription;
}

class OupvProgress {
  const OupvProgress({
    required this.totalDays,
    required this.recentDays,
    required this.nearCoastalOrGreaterDays,
    required this.readyForSignatureCount,
    required this.incompleteEntryCount,
  });

  factory OupvProgress.empty() {
    return const OupvProgress(
      totalDays: 0,
      recentDays: 0,
      nearCoastalOrGreaterDays: 0,
      readyForSignatureCount: 0,
      incompleteEntryCount: 0,
    );
  }

  factory OupvProgress.fromRow(Map<String, dynamic>? row) {
    if (row == null) {
      return OupvProgress.empty();
    }

    return OupvProgress(
      totalDays: (row['total_days'] as num? ?? 0).toDouble(),
      recentDays: (row['recent_days'] as num? ?? 0).toDouble(),
      nearCoastalOrGreaterDays:
          (row['near_coastal_or_greater_days'] as num? ?? 0).toDouble(),
      readyForSignatureCount: row['ready_for_signature_count'] as int? ?? 0,
      incompleteEntryCount: row['incomplete_entry_count'] as int? ?? 0,
    );
  }

  final double totalDays;
  final double recentDays;
  final double nearCoastalOrGreaterDays;
  final int readyForSignatureCount;
  final int incompleteEntryCount;
}

class DashboardData {
  const DashboardData({
    required this.entries,
    required this.progress,
  });

  final List<SeaServiceEntry> entries;
  final OupvProgress progress;
}

abstract class SeaDaysRepository {
  Future<DashboardData> loadDashboard();

  Future<void> saveEntry(EntryDraft draft);
}

class SupabaseSeaDaysRepository implements SeaDaysRepository {
  Future<bool> signUp(String email, String password) async {
    final response = await supabase.auth.signUp(
      email: email,
      password: password,
    );
    return response.session != null;
  }

  Future<void> signIn(String email, String password) {
    return supabase.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  Future<void> signOut() {
    return supabase.auth.signOut();
  }

  @override
  Future<DashboardData> loadDashboard() async {
    final userId = supabase.auth.currentUser!.id;

    final results = await Future.wait([
      supabase
          .from('sea_service_entry_credits')
          .select()
          .order('service_date', ascending: false)
          .limit(50),
      supabase
          .from('oupv_progress')
          .select()
          .eq('user_id', userId)
          .maybeSingle(),
    ]);

    final entryRows = results[0] as List<dynamic>;
    final progressRow = results[1] as Map<String, dynamic>?;

    return DashboardData(
      entries: entryRows
          .cast<Map<String, dynamic>>()
          .map(SeaServiceEntry.fromCreditRow)
          .toList(),
      progress: OupvProgress.fromRow(progressRow),
    );
  }

  @override
  Future<void> saveEntry(EntryDraft draft) async {
    final userId = supabase.auth.currentUser!.id;
    final vesselName = draft.vesselName.trim();

    final existingVessel = await supabase
        .from('vessels')
        .select('id')
        .eq('user_id', userId)
        .eq('name', vesselName)
        .maybeSingle();

    final vesselId = existingVessel == null
        ? (await supabase
            .from('vessels')
            .insert({
              'user_id': userId,
              'name': vesselName,
              'owner_name': _blankToNull(draft.ownerName),
              'owner_email': _blankToNull(draft.ownerEmail),
            })
            .select('id')
            .single())['id'] as String
        : existingVessel['id'] as String;

    await supabase.from('sea_service_entries').insert({
      'user_id': userId,
      'vessel_id': vesselId,
      'service_date': DateFormat('yyyy-MM-dd').format(draft.serviceDate),
      'duration_hours': draft.durationHours,
      'claimed_days': creditableDaysForSmallVessel(draft.durationHours),
      'credit_rule': 'manual_small_vessel',
      'waters': draft.waters.dbValue,
      'role': draft.role.trim(),
      'route_description': draft.routeDescription.trim(),
      'verification_status': 'self_reported',
    });
  }
}

class MockSeaDaysRepository implements SeaDaysRepository {
  MockSeaDaysRepository()
      : _entries = [
          SeaServiceEntry(
            id: 'mock-1',
            vesselName: 'Sea Trial',
            serviceDate: DateTime.now().subtract(const Duration(days: 2)),
            durationHours: 8,
            creditedDays: 1,
            waters: WatersCategory.nearCoastal,
            role: 'Operator',
            routeDescription: 'Local mock entry',
          ),
        ];

  final List<SeaServiceEntry> _entries;

  @override
  Future<DashboardData> loadDashboard() async {
    final sortedEntries = [..._entries]
      ..sort((a, b) => b.serviceDate.compareTo(a.serviceDate));

    return DashboardData(
      entries: sortedEntries,
      progress: _calculateProgress(sortedEntries),
    );
  }

  @override
  Future<void> saveEntry(EntryDraft draft) async {
    final creditedDays = creditableDaysForSmallVessel(draft.durationHours);

    _entries.add(
      SeaServiceEntry(
        id: 'mock-${DateTime.now().microsecondsSinceEpoch}',
        vesselName: draft.vesselName.trim(),
        serviceDate: draft.serviceDate,
        durationHours: draft.durationHours,
        creditedDays: creditedDays,
        waters: draft.waters,
        role: draft.role.trim(),
        routeDescription: draft.routeDescription.trim(),
      ),
    );
  }

  OupvProgress _calculateProgress(List<SeaServiceEntry> entries) {
    final sevenYearsAgo = DateTime.now().subtract(const Duration(days: 365 * 7));
    var totalDays = 0.0;
    var recentDays = 0.0;
    var nearCoastalOrGreaterDays = 0.0;
    var incompleteEntryCount = 0;

    for (final entry in entries) {
      totalDays += entry.creditedDays;
      if (!entry.serviceDate.isBefore(sevenYearsAgo)) {
        recentDays += entry.creditedDays;
      }
      if (entry.waters == WatersCategory.nearCoastal ||
          entry.waters == WatersCategory.offshore) {
        nearCoastalOrGreaterDays += entry.creditedDays;
      }
      if (entry.waters == WatersCategory.unknown ||
          entry.routeDescription.trim().isEmpty ||
          entry.role.trim().isEmpty) {
        incompleteEntryCount++;
      }
    }

    return OupvProgress(
      totalDays: totalDays,
      recentDays: recentDays,
      nearCoastalOrGreaterDays: nearCoastalOrGreaterDays,
      readyForSignatureCount: 0,
      incompleteEntryCount: incompleteEntryCount,
    );
  }
}

class SeaDaysHomePage extends StatefulWidget {
  const SeaDaysHomePage({
    required this.repository,
    required this.backendLabel,
    this.onSignOut,
    super.key,
  });

  final SeaDaysRepository repository;
  final String backendLabel;
  final Future<void> Function()? onSignOut;

  @override
  State<SeaDaysHomePage> createState() => _SeaDaysHomePageState();
}

class _SeaDaysHomePageState extends State<SeaDaysHomePage> {
  late Future<void> _loadFuture;
  List<SeaServiceEntry> _entries = [];
  OupvProgress _progress = OupvProgress.empty();

  @override
  void initState() {
    super.initState();
    _loadFuture = _loadDashboard();
  }

  @override
  Widget build(BuildContext context) {
    final progressValue = (_progress.totalDays / 360).clamp(0.0, 1.0);

    return Scaffold(
      appBar: AppBar(
        title: const Text('SeaDays'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: Center(child: Text(widget.backendLabel)),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
          if (widget.onSignOut != null)
            IconButton(
              tooltip: 'Sign out',
              onPressed: widget.onSignOut,
              icon: const Icon(Icons.logout),
            ),
        ],
      ),
      body: FutureBuilder<void>(
        future: _loadFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return _ErrorState(
              message: snapshot.error.toString(),
              onRetry: _refresh,
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _ProgressPanel(
                progress: _progress,
                progressValue: progressValue,
              ),
              const SizedBox(height: 16),
              Text(
                'Sea-service log',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              if (_entries.isEmpty)
                const _EmptyLog()
              else
                for (final entry in _entries)
                  _EntryTile(
                    entry: entry,
                    onTap: () {},
                  ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAddEntrySheet,
        icon: const Icon(Icons.add),
        label: const Text('Log time'),
      ),
    );
  }

  Future<void> _loadDashboard() async {
    final data = await widget.repository.loadDashboard();
    _entries = data.entries;
    _progress = data.progress;
  }

  void _refresh() {
    setState(() {
      _loadFuture = _loadDashboard();
    });
  }

  Future<void> _openAddEntrySheet() async {
    final draft = await showModalBottomSheet<EntryDraft>(
      context: context,
      isScrollControlled: true,
      builder: (context) => const _AddEntrySheet(),
    );

    if (draft == null) {
      return;
    }

    try {
      await widget.repository.saveEntry(draft);
      _refresh();
    } on PostgrestException catch (error) {
      _showSaveError(error.message);
    } catch (error) {
      _showSaveError(error.toString());
    }
  }

  void _showSaveError(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProgressPanel extends StatelessWidget {
  const _ProgressPanel({
    required this.progress,
    required this.progressValue,
  });

  final OupvProgress progress;
  final double progressValue;

  @override
  Widget build(BuildContext context) {
    final remaining = (360 - progress.totalDays).clamp(0, 360);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'OUPV / 6-pack progress',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _Metric(
                    label: 'Logged',
                    value: progress.totalDays.toStringAsFixed(1),
                  ),
                ),
                Expanded(
                  child: _Metric(
                    label: 'Remaining',
                    value: remaining.toStringAsFixed(1),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            LinearProgressIndicator(value: progressValue),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _StatusChip(
                  label:
                      '${progress.recentDays.toStringAsFixed(1)} recent days',
                ),
                _StatusChip(
                  label:
                      '${progress.nearCoastalOrGreaterDays.toStringAsFixed(1)} coastal+',
                ),
                _StatusChip(
                  label: '${progress.readyForSignatureCount} ready to sign',
                ),
                _StatusChip(
                  label: '${progress.incompleteEntryCount} incomplete',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelMedium),
        Text(value, style: Theme.of(context).textTheme.headlineMedium),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(label: Text(label));
  }
}

class _EmptyLog extends StatelessWidget {
  const _EmptyLog();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Text('No sea-service entries yet.'),
      ),
    );
  }
}

class _EntryTile extends StatelessWidget {
  const _EntryTile({
    required this.entry,
    required this.onTap,
  });

  final SeaServiceEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final date = DateFormat.yMMMd().format(entry.serviceDate);

    return Card(
      child: ListTile(
        onTap: onTap,
        title: Text(entry.vesselName),
        subtitle: Text('$date - ${entry.waters.label} - ${entry.role}'),
        trailing: Text('${entry.creditedDays.toStringAsFixed(1)} d'),
      ),
    );
  }
}

class EntryDraft {
  EntryDraft({
    required this.vesselName,
    required this.ownerName,
    required this.ownerEmail,
    required this.serviceDate,
    required this.durationHours,
    required this.waters,
    required this.role,
    required this.routeDescription,
  });

  final String vesselName;
  final String ownerName;
  final String ownerEmail;
  final DateTime serviceDate;
  final double durationHours;
  final WatersCategory waters;
  final String role;
  final String routeDescription;
}

class _AddEntrySheet extends StatefulWidget {
  const _AddEntrySheet();

  @override
  State<_AddEntrySheet> createState() => _AddEntrySheetState();
}

class _AddEntrySheetState extends State<_AddEntrySheet> {
  final _formKey = GlobalKey<FormState>();
  final _vesselController = TextEditingController();
  final _ownerNameController = TextEditingController();
  final _ownerEmailController = TextEditingController();
  final _hoursController = TextEditingController(text: '8');
  final _roleController = TextEditingController(text: 'Operator');
  final _routeController = TextEditingController();
  DateTime _serviceDate = DateTime.now();
  WatersCategory _waters = WatersCategory.unknown;

  @override
  void dispose() {
    _vesselController.dispose();
    _ownerNameController.dispose();
    _ownerEmailController.dispose();
    _hoursController.dispose();
    _roleController.dispose();
    _routeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottomInset),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Log sea-service time',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _vesselController,
                  decoration: const InputDecoration(
                    labelText: 'Vessel',
                    border: OutlineInputBorder(),
                  ),
                  textInputAction: TextInputAction.next,
                  validator: _required,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _ownerNameController,
                        decoration: const InputDecoration(
                          labelText: 'Owner name',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _ownerEmailController,
                        decoration: const InputDecoration(
                          labelText: 'Owner email',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.emailAddress,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _pickDate,
                        icon: const Icon(Icons.calendar_today),
                        label: Text(DateFormat.yMMMd().format(_serviceDate)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _hoursController,
                        decoration: const InputDecoration(
                          labelText: 'Hours underway',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        validator: _hoursValidator,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<WatersCategory>(
                  value: _waters,
                  decoration: const InputDecoration(
                    labelText: 'Waters',
                    border: OutlineInputBorder(),
                  ),
                  items: [
                    for (final waters in WatersCategory.values)
                      DropdownMenuItem(
                        value: waters,
                        child: Text(waters.label),
                      ),
                  ],
                  onChanged: (value) {
                    if (value == null) {
                      return;
                    }
                    setState(() => _waters = value);
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _roleController,
                  decoration: const InputDecoration(
                    labelText: 'Role',
                    border: OutlineInputBorder(),
                  ),
                  validator: _required,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _routeController,
                  decoration: const InputDecoration(
                    labelText: 'Route or notes',
                    border: OutlineInputBorder(),
                  ),
                  minLines: 2,
                  maxLines: 4,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _submit,
                    icon: const Icon(Icons.check),
                    label: const Text('Save entry'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime(1970),
      lastDate: DateTime.now(),
      initialDate: _serviceDate,
    );

    if (picked == null) {
      return;
    }

    setState(() => _serviceDate = picked);
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final draft = EntryDraft(
      vesselName: _vesselController.text.trim(),
      ownerName: _ownerNameController.text.trim(),
      ownerEmail: _ownerEmailController.text.trim(),
      serviceDate: _serviceDate,
      durationHours: double.parse(_hoursController.text.trim()),
      waters: _waters,
      role: _roleController.text.trim(),
      routeDescription: _routeController.text.trim(),
    );

    Navigator.of(context).pop(draft);
  }

  String? _required(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Required';
    }
    return null;
  }

  String? _hoursValidator(String? value) {
    final hours = double.tryParse(value?.trim() ?? '');
    if (hours == null || hours <= 0 || hours > 24) {
      return 'Enter 0-24';
    }
    return null;
  }
}

String? _blankToNull(String value) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}
