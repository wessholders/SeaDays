import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, Session } from '@supabase/supabase-js';
import { createElement, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  make?: string;
  model?: string;
  ownershipType: string;
  lengthOverallInches?: number;
  beamInches?: number;
  draftInches?: number;
  grossTons?: number;
  propulsionType: string;
  identifiers?: VesselIdentifier[];
};

type VesselIdentifier = {
  id?: string;
  identifierType: string;
  identifierValue: string;
  issuingRegion?: string;
  isPrimary?: boolean;
};

type Trip = {
  id: string;
  vesselId: string;
  tripDate: string;
  startedAt?: string;
  endedAt?: string;
  serviceRole: ServiceRole;
  purposeType?: PurposeType;
  waterBodyName?: string;
  waterBodyType: WaterBodyType;
  underwayHours?: number;
  dayCount: number;
};

type TripDraft = {
  vesselId: string;
  tripDate: string;
  startTime: string;
  endTime: string;
  serviceRole: ServiceRole;
  purposeType: PurposeType;
  waterBodyName: string;
  waterBodyType: WaterBodyType;
  underwayHours: number;
};

type VesselDraft = {
  name: string;
  displayName: string;
  ownershipType: string;
  make: string;
  model: string;
  registrationNumber: string;
  grossTons: string;
  lengthFeet: string;
  lengthInches: string;
  beamFeet: string;
  beamInches: string;
  draftFeet: string;
  draftInches: string;
  propulsionType: string;
};

type DashboardData = {
  vessels: Vessel[];
  trips: Trip[];
};

type Repository = {
  label: string;
  loadDashboard: () => Promise<DashboardData>;
  saveVessel: (draft: VesselDraft) => Promise<Vessel>;
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

function isLocalApi() {
  return apiBaseUrl.includes('127.0.0.1') || apiBaseUrl.includes('localhost');
}

function getEmailRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'seadays://';
}

function inchesFromParts(feet: string, inches: string) {
  const feetValue = Number.parseInt(feet || '0', 10);
  const inchesValue = Number.parseInt(inches || '0', 10);

  if (Number.isNaN(feetValue) && Number.isNaN(inchesValue)) {
    return undefined;
  }

  return (Number.isNaN(feetValue) ? 0 : feetValue) * 12 + (Number.isNaN(inchesValue) ? 0 : inchesValue);
}

function formatFeetAndInches(totalInches?: number) {
  if (totalInches == null) {
    return 'Not set';
  }

  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet} ft ${inches} in`;
}

function formatDateForDisplay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return value || 'Select date';
  }

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeForDisplay(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value || 'Select time';
  }

  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function combineDateAndTime(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}:00`);
}

function calculateUnderwayHours(dateValue: string, startTime: string, endTime: string) {
  if (!dateValue || !startTime || !endTime) {
    return 0;
  }

  const startedAt = combineDateAndTime(dateValue, startTime);
  let endedAt = combineDateAndTime(dateValue, endTime);

  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return 0;
  }

  if (endedAt <= startedAt) {
    endedAt = new Date(endedAt.getTime() + 24 * 60 * 60 * 1000);
  }

  const hours = (endedAt.getTime() - startedAt.getTime()) / 3_600_000;
  return Math.round(hours * 100) / 100;
}

function toIsoDateTime(dateValue: string, timeValue: string) {
  return combineDateAndTime(dateValue, timeValue).toISOString();
}

const initialVessels: Vessel[] = [
  {
    id: 'vessel-1',
    name: 'Sea Trial',
    displayName: 'Sea Trial',
    ownershipType: 'owned',
    lengthOverallInches: 264,
    beamInches: 96,
    propulsionType: 'outboard',
    identifiers: [],
  },
];

const initialTrips: Trip[] = [
  {
    id: 'trip-1',
    vesselId: 'vessel-1',
    tripDate: '2026-06-06',
    startedAt: '2026-06-06T08:00:00.000Z',
    endedAt: '2026-06-06T16:00:00.000Z',
    serviceRole: 'master',
    purposeType: 'recreational',
    waterBodyName: 'Galveston Bay',
    waterBodyType: 'near_coastal',
    underwayHours: 8,
    dayCount: 1,
  },
];

const waterTypeLabels: Record<WaterBodyType, string> = {
  inland: 'Inshore',
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

const ownershipLabels: Record<string, string> = {
  owned: 'Owned',
  family_or_friend: 'Family or friend',
  employer: 'Employer',
  chartered: 'Chartered',
  school: 'School',
  crew: 'Crew',
  unknown: 'Unknown',
};

const propulsionLabels: Record<string, string> = {
  outboard: 'Outboard',
  inboard: 'Inboard',
  sail: 'Sail',
  sterndrive: 'Sterndrive',
  jet: 'Jet',
  other: 'Other',
};

function apiHeaders(session: Session): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };

  if (isLocalApi() && session.user.id && session.user.email) {
    headers['X-Profile-Id'] = session.user.id;
    headers['X-User-Email'] = session.user.email;
  }

  return headers;
}

function mapVessel(row: Record<string, unknown>): Vessel {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Unnamed vessel'),
    displayName: row.display_name ? String(row.display_name) : undefined,
    make: row.make ? String(row.make) : undefined,
    model: row.model ? String(row.model) : undefined,
    ownershipType: String(row.ownership_type ?? 'unknown'),
    lengthOverallInches: row.length_overall_inches == null ? undefined : Number(row.length_overall_inches),
    beamInches: row.beam_inches == null ? undefined : Number(row.beam_inches),
    draftInches: row.draft_inches == null ? undefined : Number(row.draft_inches),
    grossTons: row.gross_tons == null ? undefined : Number(row.gross_tons),
    propulsionType: String(row.propulsion_type ?? 'outboard'),
    identifiers: Array.isArray(row.identifiers)
      ? row.identifiers.map((identifier) => {
          const item = identifier as Record<string, unknown>;
          return {
            id: item.id ? String(item.id) : undefined,
            identifierType: String(item.identifier_type ?? 'registration_number'),
            identifierValue: String(item.identifier_value ?? ''),
            issuingRegion: item.issuing_region ? String(item.issuing_region) : undefined,
            isPrimary: Boolean(item.is_primary),
          };
        })
      : [],
  };
}

function mapTrip(row: Record<string, unknown>): Trip {
  return {
    id: String(row.id),
    vesselId: String(row.vessel_id ?? ''),
    tripDate: String(row.trip_date),
    startedAt: row.started_at ? String(row.started_at) : undefined,
    endedAt: row.ended_at ? String(row.ended_at) : undefined,
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

  async saveVessel(draft: VesselDraft): Promise<Vessel> {
    const identifiers = draft.registrationNumber.trim()
      ? [
          {
            identifier_type: 'state_registration',
            identifier_value: draft.registrationNumber.trim(),
            issuing_country: 'US',
            is_primary: true,
          },
        ]
      : [];

    const created = await this.request('/v1/vessels', {
      method: 'POST',
      body: {
        name: draft.name.trim(),
        display_name: draft.displayName.trim() || draft.name.trim(),
        make: draft.make.trim() || null,
        model: draft.model.trim() || null,
        ownership_type: draft.ownershipType,
        length_overall_inches: inchesFromParts(draft.lengthFeet, draft.lengthInches),
        beam_inches: inchesFromParts(draft.beamFeet, draft.beamInches),
        draft_inches: inchesFromParts(draft.draftFeet, draft.draftInches),
        gross_tons: draft.grossTons.trim() ? Number.parseFloat(draft.grossTons) : null,
        propulsion_type: draft.propulsionType,
        identifiers,
      },
    });

    return mapVessel(created as Record<string, unknown>);
  }

  async saveTrip(draft: TripDraft): Promise<void> {
    await this.request('/v1/trips', {
      method: 'POST',
      body: {
        vessel_id: draft.vesselId,
        trip_date: draft.tripDate,
        started_at: toIsoDateTime(draft.tripDate, draft.startTime),
        ended_at: toIsoDateTime(draft.tripDate, draft.endTime),
        time_precision: 'exact',
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
      let detail = message;
      try {
        const parsed = JSON.parse(message) as { detail?: string | { loc?: string[]; msg?: string }[] };
        if (Array.isArray(parsed.detail)) {
          detail = parsed.detail
            .map((item) => `${item.loc?.join('.') ?? 'field'}: ${item.msg ?? 'Invalid value'}`)
            .join('\n');
        } else {
          detail = parsed.detail ?? message;
        }
      } catch {
        detail = message;
      }

      throw new Error(detail || `Request failed: ${response.status}`);
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

  async saveVessel(draft: VesselDraft): Promise<Vessel> {
    const vessel = {
      id: `vessel-${Date.now()}`,
      name: draft.name.trim(),
      displayName: draft.displayName.trim() || draft.name.trim(),
      make: draft.make.trim() || undefined,
      model: draft.model.trim() || undefined,
      ownershipType: draft.ownershipType,
      lengthOverallInches: inchesFromParts(draft.lengthFeet, draft.lengthInches),
      beamInches: inchesFromParts(draft.beamFeet, draft.beamInches),
      draftInches: inchesFromParts(draft.draftFeet, draft.draftInches),
      grossTons: draft.grossTons.trim() ? Number.parseFloat(draft.grossTons) : undefined,
      propulsionType: draft.propulsionType,
      identifiers: draft.registrationNumber.trim()
        ? [
            {
              identifierType: 'state_registration',
              identifierValue: draft.registrationNumber.trim(),
              isPrimary: true,
            },
          ]
        : [],
    };
    this.vessels = [vessel, ...this.vessels];
    return vessel;
  }

  async saveTrip(draft: TripDraft): Promise<void> {
    this.trips = [
      {
        id: `trip-${Date.now()}`,
        vesselId: draft.vesselId,
        tripDate: draft.tripDate,
        startedAt: toIsoDateTime(draft.tripDate, draft.startTime),
        endedAt: toIsoDateTime(draft.tripDate, draft.endTime),
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
  const [showVesselModal, setShowVesselModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, tone: 'success' | 'error' | 'info' = 'info', autoDismiss = true) => {
    if (toastTimer.current) {
      globalThis.clearTimeout(toastTimer.current);
    }
    setToast({ message, tone });
    if (autoDismiss) {
      toastTimer.current = globalThis.setTimeout(() => setToast(null), 4500);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        globalThis.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    showToast('Loading dashboard...', 'info', false);
    try {
      const data = await repository.loadDashboard();
      setVessels(data.vessels);
      setTrips(data.trips);
      showToast('Dashboard updated.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      showToast(`Load failed: ${message}`, 'error');
      Alert.alert('Load failed', message);
    } finally {
      setLoading(false);
    }
  }, [repository, showToast]);

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
    showToast('Saving trip...', 'info', false);
    try {
      await repository.saveTrip(draft);
      setShowTripModal(false);
      await loadDashboard();
      showToast('Trip logged.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      showToast(`Trip save failed: ${message}`, 'error');
      Alert.alert('Save failed', message);
    }
  }

  async function saveVessel(draft: VesselDraft) {
    showToast('Saving vessel...', 'info', false);
    try {
      const vessel = await repository.saveVessel(draft);
      setShowVesselModal(false);
      await loadDashboard();
      showToast(`${vessel.displayName ?? vessel.name} saved.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      showToast(`Vessel save failed: ${message}`, 'error');
      Alert.alert('Vessel save failed', message);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {toast ? (
        <View
          style={[
            styles.toast,
            toast.tone === 'success' && styles.toastSuccess,
            toast.tone === 'error' && styles.toastError,
            toast.tone === 'info' && styles.toastInfo,
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      ) : null}
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
          <Text style={styles.sectionTitle}>Vessels</Text>
          <Pressable style={styles.primaryButton} onPress={() => setShowVesselModal(true)}>
            <MaterialCommunityIcons name="plus" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Add Vessel</Text>
          </Pressable>
        </View>

        {vessels.length === 0 && !loading ? <Text style={styles.emptyText}>Add a frequent vessel before logging trips.</Text> : null}
        {vessels.map((vessel) => (
          <View key={vessel.id} style={styles.vesselRow}>
            <View style={styles.tripIcon}>
              <MaterialCommunityIcons name="ferry" size={22} color="#176b75" />
            </View>
            <View style={styles.tripBody}>
              <Text style={styles.tripTitle}>{vessel.displayName ?? vessel.name}</Text>
              <Text style={styles.tripMeta}>
                {ownershipLabels[vessel.ownershipType] ?? vessel.ownershipType} - {propulsionLabels[vessel.propulsionType] ?? vessel.propulsionType}
              </Text>
              <Text style={styles.tripMeta}>
                {vessel.make || 'Unknown make'} {vessel.model || ''} - LOA {formatFeetAndInches(vessel.lengthOverallInches)}
              </Text>
            </View>
          </View>
        ))}

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
        vessels={vessels}
        onCreateVessel={() => {
          setShowTripModal(false);
          setShowVesselModal(true);
        }}
      />
      <VesselModal
        visible={showVesselModal}
        onClose={() => setShowVesselModal(false)}
        onSave={saveVessel}
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
  vessels,
  onCreateVessel,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: TripDraft) => void;
  vessels: Vessel[];
  onCreateVessel: () => void;
}) {
  const [vesselId, setVesselId] = useState(vessels[0]?.id ?? '');
  const [tripDate, setTripDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('14:00');
  const [waterBodyName, setWaterBodyName] = useState('');
  const [serviceRole, setServiceRole] = useState<ServiceRole>('master');
  const [purposeType, setPurposeType] = useState<PurposeType>('recreational');
  const [waterBodyType, setWaterBodyType] = useState<WaterBodyType>('inland');

  const underwayHours = useMemo(
    () => calculateUnderwayHours(tripDate, startTime, endTime),
    [endTime, startTime, tripDate],
  );

  useEffect(() => {
    if (visible && !vesselId && vessels[0]?.id) {
      setVesselId(vessels[0].id);
    }
  }, [vesselId, vessels, visible]);

  function submit() {
    if (!vesselId || !tripDate.trim() || !startTime || !endTime || underwayHours <= 0 || underwayHours > 24) {
      Alert.alert('Check trip', 'Select a vessel, date, start time, and end time.');
      return;
    }

    onSave({
      vesselId,
      tripDate,
      startTime,
      endTime,
      serviceRole,
      purposeType,
      waterBodyName,
      waterBodyType,
      underwayHours,
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
            <Text style={styles.fieldLabel}>Vessel</Text>
            <View style={styles.segmentWrap}>
              {vessels.map((vessel) => {
                const selected = vessel.id === vesselId;
                return (
                  <Pressable
                    key={vessel.id}
                    style={[styles.segment, selected && styles.segmentSelected]}
                    onPress={() => setVesselId(vessel.id)}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                      {vessel.displayName ?? vessel.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.linkButton} onPress={onCreateVessel}>
              <Text style={styles.linkButtonText}>or create a new vessel</Text>
            </Pressable>
            <DateInput label="Trip date" value={tripDate} onChangeText={setTripDate} />
            <View style={styles.twoColumn}>
              <TimeInput label="Start time" value={startTime} onChangeText={setStartTime} />
              <TimeInput label="End time" value={endTime} onChangeText={setEndTime} />
            </View>
            <View style={styles.quickTimeRow}>
              <Pressable
                style={styles.quickTimeButton}
                onPress={() => {
                  setStartTime('10:00');
                  setEndTime('14:00');
                }}
              >
                <Text style={styles.quickTimeText}>Default 4 hr</Text>
              </Pressable>
              <Pressable
                style={styles.quickTimeButton}
                onPress={() => {
                  setStartTime('08:00');
                  setEndTime('16:00');
                }}
              >
                <Text style={styles.quickTimeText}>Full day</Text>
              </Pressable>
              <Pressable
                style={styles.quickTimeButton}
                onPress={() => {
                  setStartTime('12:00');
                  setEndTime('18:00');
                }}
              >
                <Text style={styles.quickTimeText}>Afternoon</Text>
              </Pressable>
            </View>
            <View style={styles.qualifyPanel}>
              <Text style={styles.metricLabel}>Calculated time at sea</Text>
              <Text style={styles.metricValue}>{underwayHours.toFixed(2)} hours</Text>
              <Text style={styles.tripMeta}>
                {underwayHours >= 4 ? 'Qualifies as 1 sea day.' : 'Needs at least 4 hours to count as a sea day.'}
              </Text>
            </View>
            <LabeledInput label="Water body" value={waterBodyName} onChangeText={setWaterBodyName} placeholder="Galveston Bay" />
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

function VesselModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: VesselDraft) => void;
}) {
  const [draft, setDraft] = useState<VesselDraft>({
    name: '',
    displayName: '',
    ownershipType: 'owned',
    make: '',
    model: '',
    registrationNumber: '',
    grossTons: '',
    lengthFeet: '',
    lengthInches: '',
    beamFeet: '',
    beamInches: '',
    draftFeet: '',
    draftInches: '',
    propulsionType: 'outboard',
  });

  function setField(field: keyof VesselDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function submit() {
    if (!draft.name.trim()) {
      Alert.alert('Check vessel', 'Enter a vessel name.');
      return;
    }

    onSave(draft);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Vessel</Text>
            <Pressable style={styles.iconButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#0f3f46" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <LabeledInput label="Vessel name" value={draft.name} onChangeText={(value) => setField('name', value)} />
            <LabeledInput
              label="Display name"
              value={draft.displayName}
              onChangeText={(value) => setField('displayName', value)}
              placeholder="Optional"
            />
            <View style={styles.twoColumn}>
              <LabeledInput label="Make" value={draft.make} onChangeText={(value) => setField('make', value)} />
              <LabeledInput label="Model" value={draft.model} onChangeText={(value) => setField('model', value)} />
            </View>
            <LabeledInput
              label="Registration number"
              value={draft.registrationNumber}
              onChangeText={(value) => setField('registrationNumber', value)}
              placeholder="Optional"
            />
            <SegmentedOptions
              label="Ownership"
              value={draft.ownershipType}
              options={ownershipLabels}
              onChange={(value) => setField('ownershipType', value)}
            />
            <SegmentedOptions
              label="Propulsion"
              value={draft.propulsionType}
              options={propulsionLabels}
              onChange={(value) => setField('propulsionType', value)}
            />
            <View style={styles.twoColumn}>
              <LabeledInput
                label="Length ft"
                value={draft.lengthFeet}
                onChangeText={(value) => setField('lengthFeet', value)}
                keyboardType="decimal-pad"
              />
              <LabeledInput
                label="Length in"
                value={draft.lengthInches}
                onChangeText={(value) => setField('lengthInches', value)}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.twoColumn}>
              <LabeledInput
                label="Beam ft"
                value={draft.beamFeet}
                onChangeText={(value) => setField('beamFeet', value)}
                keyboardType="decimal-pad"
              />
              <LabeledInput
                label="Beam in"
                value={draft.beamInches}
                onChangeText={(value) => setField('beamInches', value)}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.twoColumn}>
              <LabeledInput
                label="Draft ft"
                value={draft.draftFeet}
                onChangeText={(value) => setField('draftFeet', value)}
                keyboardType="decimal-pad"
              />
              <LabeledInput
                label="Draft in"
                value={draft.draftInches}
                onChangeText={(value) => setField('draftInches', value)}
                keyboardType="decimal-pad"
              />
            </View>
            <LabeledInput
              label="Gross tons"
              value={draft.grossTons}
              onChangeText={(value) => setField('grossTons', value)}
              keyboardType="decimal-pad"
              placeholder="Optional"
            />
            <Pressable style={styles.saveButton} onPress={submit}>
              <MaterialCommunityIcons name="check" size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Save Vessel</Text>
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
  webInputType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'email-address';
  secureTextEntry?: boolean;
  webInputType?: 'date' | 'time';
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
        {...(Platform.OS === 'web' && webInputType ? { type: webInputType } : {})}
      />
    </View>
  );
}

function DateInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <PickerInput
      label={label}
      value={value}
      displayValue={formatDateForDisplay(value)}
      onChangeText={onChangeText}
      icon="calendar-month"
      webInputType="date"
    />
  );
}

function TimeInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <PickerInput
      label={label}
      value={value}
      displayValue={formatTimeForDisplay(value)}
      onChangeText={onChangeText}
      icon="clock-outline"
      webInputType="time"
    />
  );
}

function PickerInput({
  label,
  value,
  displayValue,
  onChangeText,
  icon,
  webInputType,
}: {
  label: string;
  value: string;
  displayValue: string;
  onChangeText: (value: string) => void;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  webInputType: 'date' | 'time';
}) {
  const input =
    Platform.OS === 'web'
      ? createElement('input', {
          type: webInputType,
          value,
          onChange: (event: { currentTarget: { value: string } }) => onChangeText(event.currentTarget.value),
          style: webPickerInputStyle,
          'aria-label': label,
        })
      : (
          <TextInput
            style={styles.pickerNativeInput}
            value={value}
            onChangeText={onChangeText}
            keyboardType="default"
          />
        );

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.pickerShell}>
        <MaterialCommunityIcons name={icon} size={20} color="#176b75" />
        <View style={styles.pickerTextBlock}>
          <Text style={styles.pickerDisplay}>{displayValue}</Text>
          <Text style={styles.pickerHint}>{webInputType === 'date' ? 'Open calendar' : 'Choose time'}</Text>
        </View>
        {input}
      </View>
    </View>
  );
}

const webPickerInputStyle: CSSProperties = {
  backgroundColor: '#f4f8f8',
  borderColor: '#d7e4e5',
  borderRadius: 8,
  borderStyle: 'solid',
  borderWidth: 1,
  color: '#0f3035',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 800,
  minHeight: 42,
  minWidth: 150,
  paddingLeft: 10,
  paddingRight: 10,
};

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
  toast: {
    alignSelf: 'center',
    borderRadius: 8,
    borderWidth: 1,
    left: 16,
    maxWidth: 720,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'absolute',
    right: 16,
    top: 12,
    zIndex: 20,
  },
  toastSuccess: {
    backgroundColor: '#e7f6ed',
    borderColor: '#70b987',
  },
  toastError: {
    backgroundColor: '#fff0f0',
    borderColor: '#d98282',
  },
  toastInfo: {
    backgroundColor: '#edf5fb',
    borderColor: '#8bb8d8',
  },
  toastText: {
    color: '#15363a',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
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
  vesselRow: {
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
  twoColumn: {
    flexDirection: 'row',
    gap: 10,
  },
  qualifyPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#c9dada',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  quickTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  quickTimeButton: {
    backgroundColor: '#e9f3f4',
    borderColor: '#bad2d5',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quickTimeText: {
    color: '#176b75',
    fontSize: 13,
    fontWeight: '800',
  },
  field: {
    flex: 1,
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
  pickerShell: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#c9dada',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    overflow: 'hidden',
    paddingHorizontal: 12,
    position: 'relative',
  },
  pickerTextBlock: {
    flex: 1,
  },
  pickerDisplay: {
    color: '#0f3035',
    fontSize: 16,
    fontWeight: '800',
  },
  pickerHint: {
    color: '#5c7376',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  pickerNativeInput: {
    backgroundColor: '#f4f8f8',
    borderColor: '#d7e4e5',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f3035',
    fontSize: 16,
    fontWeight: '800',
    minHeight: 42,
    minWidth: 132,
    paddingHorizontal: 10,
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
  linkButton: {
    alignItems: 'flex-start',
    marginBottom: 14,
    marginTop: 8,
    paddingVertical: 8,
  },
  linkButtonText: {
    color: '#176b75',
    fontSize: 14,
    fontWeight: '800',
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
