import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type WaterBodyType = 'inland' | 'near_coastal' | 'offshore' | 'great_lakes' | 'unknown';
type ServiceRole = 'master' | 'mate' | 'operator' | 'deckhand' | 'other';
type PurposeType = 'recreational' | 'delivery' | 'training' | 'charter' | 'other';

type Vessel = {
  id: string;
  name: string;
  displayName?: string;
  propulsionType: string;
};

type Trip = {
  id: string;
  vesselId: string;
  tripDate: string;
  serviceRole: ServiceRole;
  purposeType?: PurposeType;
  waterBodyName?: string;
  waterBodyType: WaterBodyType;
  underwayHours?: number;
  dayCount: number;
};

type TripDraft = {
  vesselName: string;
  tripDate: string;
  serviceRole: ServiceRole;
  purposeType: PurposeType;
  waterBodyName: string;
  waterBodyType: WaterBodyType;
  underwayHours: number;
};

type DashboardData = {
  vessels: Vessel[];
  trips: Trip[];
};

type Repository = {
  label: string;
  loadDashboard: () => Promise<DashboardData>;
  saveTrip: (draft: TripDraft) => Promise<void>;
};

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const hasSupabaseConfig =
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('<') &&
  supabaseAnonKey.length > 20 &&
  !supabaseAnonKey.includes('<');

const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

function getEmailRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'seadays://';
}

const initialVessels: Vessel[] = [
  {
    id: 'vessel-1',
    name: 'Sea Trial',
    displayName: 'Sea Trial',
    propulsionType: 'outboard',
  },
];

const initialTrips: Trip[] = [
  {
    id: 'trip-1',
    vesselId: 'vessel-1',
    tripDate: '2026-06-06',
    serviceRole: 'master',
    purposeType: 'recreational',
    waterBodyName: 'Galveston Bay',
    waterBodyType: 'near_coastal',
    underwayHours: 8,
    dayCount: 1,
  },
];

const waterTypeLabels: Record<WaterBodyType, string> = {
  inland: 'Inland',
  near_coastal: 'Near Coastal',
  offshore: 'Offshore',
  great_lakes: 'Great Lakes',
  unknown: 'Unknown',
};

const roleLabels: Record<ServiceRole, string> = {
  master: 'Master',
  mate: 'Mate',
  operator: 'Operator',
  deckhand: 'Deckhand',
  other: 'Other',
};

const purposeLabels: Record<PurposeType, string> = {
  recreational: 'Recreational',
  delivery: 'Delivery',
  training: 'Training',
  charter: 'Charter',
  other: 'Other',
};

function apiHeaders(session: Session) {
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

function mapVessel(row: Record<string, unknown>): Vessel {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Unnamed vessel'),
    displayName: row.display_name ? String(row.display_name) : undefined,
    propulsionType: String(row.propulsion_type ?? 'outboard'),
  };
}

function mapTrip(row: Record<string, unknown>): Trip {
  return {
    id: String(row.id),
    vesselId: String(row.vessel_id ?? ''),
    tripDate: String(row.trip_date),
    serviceRole: String(row.service_role ?? 'other') as ServiceRole,
    purposeType: row.purpose_type ? (String(row.purpose_type) as PurposeType) : undefined,
    waterBodyName: row.water_body_name ? String(row.water_body_name) : undefined,
    waterBodyType: String(row.water_body_type ?? 'unknown') as WaterBodyType,
    underwayHours: row.underway_hours == null ? undefined : Number(row.underway_hours),
    dayCount: Number(row.day_count ?? 0),
  };
}

class ApiRepository implements Repository {
  label = 'Supabase API';

  constructor(private readonly session: Session) {}

  async loadDashboard(): Promise<DashboardData> {
    await this.request('/v1/profile');
    const [vessels, trips] = await Promise.all([
      this.request('/v1/vessels'),
      this.request('/v1/trips'),
    ]);
    return {
      vessels: (vessels as Record<string, unknown>[]).map(mapVessel),
      trips: (trips as Record<string, unknown>[]).map(mapTrip),
    };
  }

  async saveTrip(draft: TripDraft): Promise<void> {
    const dashboard = await this.loadDashboard();
    let vessel = dashboard.vessels.find(
      (item) => item.name.toLowerCase() === draft.vesselName.trim().toLowerCase(),
    );

    if (!vessel) {
      const created = await this.request('/v1/vessels', {
        method: 'POST',
        body: {
          name: draft.vesselName.trim(),
          display_name: draft.vesselName.trim(),
          ownership_type: 'unknown',
          propulsion_type: 'outboard',
          identifiers: [],
        },
      });
      vessel = mapVessel(created as Record<string, unknown>);
    }

    await this.request('/v1/trips', {
      method: 'POST',
      body: {
        vessel_id: vessel.id,
        trip_date: draft.tripDate,
        time_precision: 'date_only',
        service_role: draft.serviceRole,
        purpose_type: draft.purposeType,
        water_body_name: draft.waterBodyName.trim(),
        water_body_type: draft.waterBodyType,
        underway_hours: draft.underwayHours,
        day_count: draft.underwayHours >= 4 ? 1 : 0,
        near_coastal: draft.waterBodyType === 'near_coastal',
        inland: draft.waterBodyType === 'inland',
        great_lakes: draft.waterBodyType === 'great_lakes',
        ocean: draft.waterBodyType === 'offshore',
        status: 'draft',
      },
    });
  }

  private async request(path: string, options: { method?: string; body?: unknown } = {}) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: apiHeaders(this.session),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed: ${response.status}`);
    }

    return response.json();
  }
}

class MockRepository implements Repository {
  label = 'Mock workspace';
  private vessels = initialVessels;
  private trips = initialTrips;

  async loadDashboard(): Promise<DashboardData> {
    return { vessels: this.vessels, trips: this.trips };
  }

  async saveTrip(draft: TripDraft): Promise<void> {
    let vessel = this.vessels.find(
      (item) => item.name.toLowerCase() === draft.vesselName.trim().toLowerCase(),
    );
    if (!vessel) {
      vessel = {
        id: `vessel-${Date.now()}`,
        name: draft.vesselName.trim(),
        displayName: draft.vesselName.trim(),
        propulsionType: 'outboard',
      };
      this.vessels = [...this.vessels, vessel];
    }

    this.trips = [
      {
        id: `trip-${Date.now()}`,
        vesselId: vessel.id,
        tripDate: draft.tripDate,
        serviceRole: draft.serviceRole,
        purposeType: draft.purposeType,
        waterBodyName: draft.waterBodyName.trim(),
        waterBodyType: draft.waterBodyType,
        underwayHours: draft.underwayHours,
        dayCount: draft.underwayHours >= 4 ? 1 : 0,
      },
      ...this.trips,
    ];
  }
}

const mockRepository = new MockRepository();

export default function DashboardScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (!hasSupabaseConfig || !supabase) {
    return <Dashboard repository={mockRepository} />;
  }

  if (!authChecked) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <Dashboard repository={new ApiRepository(session)} onSignOut={() => supabase.auth.signOut()} />;
}

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.centeredPage}>
      <ActivityIndicator color="#176b75" size="large" />
    </SafeAreaView>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [loading, setLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errorDescription = params.get('error_description');
    const errorCode = params.get('error_code');

    if (!errorDescription) {
      return;
    }

    const readableMessage =
      errorCode === 'otp_expired'
        ? 'That confirmation link is expired or was already used. Enter your email, resend the confirmation email, and use the newest link.'
        : errorDescription.replace(/\+/g, ' ');

    setAuthNotice(readableMessage);
    setCanResendConfirmation(true);
    setMode('sign-up');
    window.history.replaceState(null, document.title, window.location.pathname);
  }, []);

  async function submit() {
    if (!email.trim() || password.length < 6 || !supabase) {
      Alert.alert('Check sign in', 'Enter an email and at least 6 password characters.');
      return;
    }

    setLoading(true);
    try {
      const result =
        mode === 'sign-in'
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: {
                emailRedirectTo: getEmailRedirectUrl(),
              },
            });

      if (result.error) {
        throw result.error;
      }

      if (mode === 'sign-up') {
        const notice = result.data.session
          ? 'Account created. You are signed in.'
          : 'Account created. Check your email and confirm your address, then return here to sign in.';
        setAuthNotice(notice);
        setCanResendConfirmation(!result.data.session);
        Alert.alert(
          result.data.session ? 'Account created' : 'Check email',
          notice,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      setAuthNotice(message);
      Alert.alert('Authentication failed', message);
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (!email.trim() || !supabase) {
      Alert.alert('Email needed', 'Enter the email address you used to create the account.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
        },
      });

      if (error) {
        throw error;
      }

      setAuthNotice(
        'Confirmation email sent if that account is waiting for confirmation. Use the newest email link; older links may no longer work.',
      );
      Alert.alert('Confirmation sent', 'Check your email for a fresh confirmation link.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      setAuthNotice(message);
      Alert.alert('Resend failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.authPage}>
        <Text style={styles.title}>SeaDays</Text>
        <Text style={styles.authSubtitle}>{mode === 'sign-in' ? 'Sign in to continue' : 'Create your account'}</Text>
        {authNotice ? <Text style={styles.authNotice}>{authNotice}</Text> : null}
        <LabeledInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <LabeledInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Pressable style={styles.saveButton} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <MaterialCommunityIcons name="login" size={20} color="#ffffff" />}
          <Text style={styles.saveButtonText}>{mode === 'sign-in' ? 'Sign In' : 'Create Account'}</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => setMode((current) => (current === 'sign-in' ? 'sign-up' : 'sign-in'))}
        >
          <Text style={styles.secondaryButtonText}>
            {mode === 'sign-in' ? 'Create a new account first' : 'Use an existing account'}
          </Text>
        </Pressable>
        {mode === 'sign-up' || canResendConfirmation ? (
          <Pressable style={styles.secondaryButton} onPress={resendConfirmation} disabled={loading}>
            <Text style={styles.secondaryButtonText}>Resend confirmation email</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Dashboard({ repository, onSignOut }: { repository: Repository; onSignOut?: () => void }) {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTripModal, setShowTripModal] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await repository.loadDashboard();
      setVessels(data.vessels);
      setTrips(data.trips);
    } catch (error) {
      Alert.alert('Load failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const progress = useMemo(() => {
    const totalDays = trips.reduce((sum, trip) => sum + trip.dayCount, 0);
    const recentDays = totalDays;
    const nearCoastalDays = trips
      .filter((trip) => trip.waterBodyType === 'near_coastal' || trip.waterBodyType === 'offshore')
      .reduce((sum, trip) => sum + trip.dayCount, 0);

    return {
      totalDays,
      recentDays,
      nearCoastalDays,
      totalRemaining: Math.max(360 - totalDays, 0),
      progressValue: Math.min(totalDays / 360, 1),
    };
  }, [trips]);

  async function saveTrip(draft: TripDraft) {
    try {
      await repository.saveTrip(draft);
      setShowTripModal(false);
      await loadDashboard();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{repository.label}</Text>
            <Text style={styles.title}>SeaDays</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={loadDashboard}>
              <MaterialCommunityIcons name="refresh" size={24} color="#0f3f46" />
            </Pressable>
            {onSignOut ? (
              <Pressable style={styles.iconButton} onPress={onSignOut}>
                <MaterialCommunityIcons name="logout" size={24} color="#0f3f46" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.progressPanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>OUPV / 6-Pack Progress</Text>
            <Text style={styles.panelBadge}>{progress.totalDays.toFixed(1)} / 360 days</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress.progressValue * 100}%` }]} />
          </View>
          <View style={styles.metricGrid}>
            <Metric label="Remaining" value={progress.totalRemaining.toFixed(1)} />
            <Metric label="Recent" value={progress.recentDays.toFixed(1)} />
            <Metric label="Coastal+" value={progress.nearCoastalDays.toFixed(1)} />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trips</Text>
          <Pressable style={styles.primaryButton} onPress={() => setShowTripModal(true)}>
            <MaterialCommunityIcons name="plus" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Log Trip</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color="#176b75" /> : null}
        {!loading && trips.length === 0 ? <Text style={styles.emptyText}>No trips yet.</Text> : null}

        {trips.map((trip) => {
          const vessel = vessels.find((item) => item.id === trip.vesselId);
          return (
            <View key={trip.id} style={styles.tripRow}>
              <View style={styles.tripIcon}>
                <MaterialCommunityIcons name="sail-boat" size={22} color="#176b75" />
              </View>
              <View style={styles.tripBody}>
                <Text style={styles.tripTitle}>{vessel?.displayName ?? vessel?.name ?? 'Unknown vessel'}</Text>
                <Text style={styles.tripMeta}>
                  {trip.tripDate} - {roleLabels[trip.serviceRole]} - {waterTypeLabels[trip.waterBodyType]}
                </Text>
                <Text style={styles.tripMeta}>
                  {trip.waterBodyName || 'No water body'} - {(trip.underwayHours ?? 0).toFixed(1)} hours
                </Text>
              </View>
              <Text style={styles.dayCount}>{trip.dayCount.toFixed(1)} d</Text>
            </View>
          );
        })}
      </ScrollView>

      <TripModal
        visible={showTripModal}
        onClose={() => setShowTripModal(false)}
        onSave={saveTrip}
        defaultVesselName={vessels[0]?.name ?? ''}
      />
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function TripModal({
  visible,
  onClose,
  onSave,
  defaultVesselName,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: TripDraft) => void;
  defaultVesselName: string;
}) {
  const [vesselName, setVesselName] = useState(defaultVesselName);
  const [tripDate, setTripDate] = useState('2026-06-08');
  const [waterBodyName, setWaterBodyName] = useState('');
  const [underwayHours, setUnderwayHours] = useState('8');
  const [serviceRole, setServiceRole] = useState<ServiceRole>('master');
  const [purposeType, setPurposeType] = useState<PurposeType>('recreational');
  const [waterBodyType, setWaterBodyType] = useState<WaterBodyType>('near_coastal');

  useEffect(() => {
    if (visible) {
      setVesselName(defaultVesselName);
    }
  }, [defaultVesselName, visible]);

  function submit() {
    const hours = Number.parseFloat(underwayHours);
    if (!vesselName.trim() || !tripDate.trim() || Number.isNaN(hours) || hours < 0 || hours > 24) {
      Alert.alert('Check trip', 'Enter a vessel, date, and 0-24 underway hours.');
      return;
    }

    onSave({
      vesselName,
      tripDate,
      serviceRole,
      purposeType,
      waterBodyName,
      waterBodyType,
      underwayHours: hours,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Trip</Text>
            <Pressable style={styles.iconButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#0f3f46" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <LabeledInput label="Vessel" value={vesselName} onChangeText={setVesselName} />
            <LabeledInput label="Trip date" value={tripDate} onChangeText={setTripDate} />
            <LabeledInput label="Water body" value={waterBodyName} onChangeText={setWaterBodyName} placeholder="Galveston Bay" />
            <LabeledInput
              label="Hours underway"
              value={underwayHours}
              onChangeText={setUnderwayHours}
              keyboardType="decimal-pad"
            />
            <SegmentedOptions label="Role" value={serviceRole} options={roleLabels} onChange={setServiceRole} />
            <SegmentedOptions label="Purpose" value={purposeType} options={purposeLabels} onChange={setPurposeType} />
            <SegmentedOptions label="Waters" value={waterBodyType} options={waterTypeLabels} onChange={setWaterBodyType} />
            <Pressable style={styles.saveButton} onPress={submit}>
              <MaterialCommunityIcons name="check" size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Save Trip</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'email-address';
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function SegmentedOptions<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.segmentWrap}>
        {(Object.keys(options) as T[]).map((optionValue) => {
          const optionLabel = options[optionValue];
          const selected = optionValue === value;
          return (
            <Pressable
              key={optionValue}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => onChange(optionValue)}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{optionLabel}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7f7',
  },
  centeredPage: {
    alignItems: 'center',
    backgroundColor: '#f4f7f7',
    flex: 1,
    justifyContent: 'center',
  },
  page: {
    gap: 16,
    padding: 16,
  },
  authPage: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  authSubtitle: {
    color: '#557174',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 18,
  },
  authNotice: {
    backgroundColor: '#fff6df',
    borderColor: '#e4c16d',
    borderRadius: 8,
    borderWidth: 1,
    color: '#6e5510',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 14,
    padding: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  eyebrow: {
    color: '#577174',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: '#092f35',
    fontSize: 34,
    fontWeight: '800',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#e4eeee',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  progressPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#d7e4e5',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: '#103d43',
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  panelBadge: {
    color: '#176b75',
    fontSize: 14,
    fontWeight: '800',
  },
  progressTrack: {
    backgroundColor: '#d8e6e7',
    borderRadius: 999,
    height: 10,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#1b7f8a',
    height: '100%',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  metric: {
    backgroundColor: '#f1f7f7',
    borderRadius: 8,
    flex: 1,
    padding: 12,
  },
  metricLabel: {
    color: '#557174',
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: '#092f35',
    fontSize: 24,
    fontWeight: '800',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#092f35',
    fontSize: 22,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#176b75',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
  },
  secondaryButtonText: {
    color: '#176b75',
    fontWeight: '800',
  },
  tripRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d7e4e5',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  tripIcon: {
    alignItems: 'center',
    backgroundColor: '#e5f1f2',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  tripBody: {
    flex: 1,
  },
  tripTitle: {
    color: '#123d43',
    fontSize: 16,
    fontWeight: '800',
  },
  tripMeta: {
    color: '#5c7376',
    fontSize: 13,
    marginTop: 2,
  },
  dayCount: {
    color: '#176b75',
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: '#557174',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSafeArea: {
    backgroundColor: '#f4f7f7',
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  modalTitle: {
    color: '#092f35',
    fontSize: 26,
    fontWeight: '900',
  },
  modalContent: {
    padding: 16,
    paddingTop: 0,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#375a5e',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#c9dada',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f3035',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  segmentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segment: {
    backgroundColor: '#ffffff',
    borderColor: '#c9dada',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentSelected: {
    backgroundColor: '#176b75',
    borderColor: '#176b75',
  },
  segmentText: {
    color: '#30585d',
    fontWeight: '700',
  },
  segmentTextSelected: {
    color: '#ffffff',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#176b75',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 52,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
