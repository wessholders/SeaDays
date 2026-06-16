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

type Profile = {
  id: string;
  email: string;
  displayName?: string;
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

type ActiveTab = 'dashboard' | 'logs' | 'vessels' | 'progress' | 'account';
type InfoPageKey = 'about' | 'privacy' | 'terms' | 'accessibility' | 'contact';
type TrendRange = '1M' | 'YTD' | '1Y' | '3Y';

type SummaryMetrics = {
  totalDays: number;
  totalEntries: number;
  totalHours: number;
  totalLoggedDays: number;
  recentDays: number;
  nearCoastalDays: number;
  vesselCount: number;
  averageHours: number;
  lastTripDate: string;
  qualifyingRate: number;
  missingDataCount: number;
  signatureNeededCount: number;
  exportReadyCount: number;
  exportReadiness: number;
  totalRemaining: number;
  progressValue: number;
};

type DashboardData = {
  profile: Profile;
  vessels: Vessel[];
  trips: Trip[];
};

type Repository = {
  label: string;
  loadDashboard: () => Promise<DashboardData>;
  updateProfileDisplayName: (displayName: string) => Promise<Profile>;
  saveVessel: (draft: VesselDraft) => Promise<Vessel>;
  updateVessel: (vesselId: string, draft: VesselDraft) => Promise<Vessel>;
  saveTrip: (draft: TripDraft) => Promise<void>;
  updateTrip: (tripId: string, draft: TripDraft) => Promise<void>;
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

function splitInches(totalInches?: number) {
  if (totalInches == null) {
    return { feet: '', inches: '' };
  }

  return {
    feet: Math.floor(totalInches / 12).toString(),
    inches: (totalInches % 12).toString(),
  };
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

function timeFromIso(value?: string, fallback = '10:00') {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function makeTripPayload(draft: TripDraft) {
  return {
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
  };
}

function makeVesselPayload(draft: VesselDraft) {
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

  return {
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
  };
}

function vesselToDraft(vessel?: Vessel | null): VesselDraft {
  const length = splitInches(vessel?.lengthOverallInches);
  const beam = splitInches(vessel?.beamInches);
  const draft = splitInches(vessel?.draftInches);
  const registration = vessel?.identifiers?.find((identifier) => identifier.identifierType === 'state_registration');

  return {
    name: vessel?.name ?? '',
    displayName: vessel?.displayName ?? '',
    ownershipType: vessel?.ownershipType ?? 'owned',
    make: vessel?.make ?? '',
    model: vessel?.model ?? '',
    registrationNumber: registration?.identifierValue ?? '',
    grossTons: vessel?.grossTons == null ? '' : vessel.grossTons.toString(),
    lengthFeet: length.feet,
    lengthInches: length.inches,
    beamFeet: beam.feet,
    beamInches: beam.inches,
    draftFeet: draft.feet,
    draftInches: draft.inches,
    propulsionType: vessel?.propulsionType ?? 'outboard',
  };
}

function percent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function vesselNeedsOwnerSignature(vessel?: Vessel) {
  if (!vessel) {
    return false;
  }

  return vessel.ownershipType !== 'owned' && vessel.ownershipType !== 'unknown';
}

function tripHasMissingExportData(trip: Trip) {
  return !trip.vesselId || !trip.waterBodyName || !trip.startedAt || !trip.endedAt || !trip.underwayHours;
}

const trendRangeOptions: { key: TrendRange; label: string }[] = [
  { key: '1M', label: '1M' },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1Y' },
  { key: '3Y', label: '3Y' },
];

function buildTrendBuckets(trips: Trip[], range: TrendRange) {
  const referenceDate = latestTripDate(trips) ?? new Date();
  const buckets: { key: string; label: string; outings: number }[] = [];

  if (range === '1M') {
    const start = startOfWeekMonday(addDays(referenceDate, -27));
    const end = startOfWeekMonday(referenceDate);
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 7)) {
      buckets.push({ key: isoDateKey(cursor), label: formatShortDate(cursor), outings: 0 });
    }

    trips.forEach((trip) => {
      const date = parseTripDate(trip.tripDate);
      if (!date || date < start || date > referenceDate) {
        return;
      }

      const key = isoDateKey(startOfWeekMonday(date));
      const bucket = buckets.find((item) => item.key === key);
      if (bucket) {
        bucket.outings += 1;
      }
    });

    return buckets;
  }

  const monthCount = range === 'YTD' ? referenceDate.getMonth() + 1 : range === '1Y' ? 12 : 36;
  const start =
    range === 'YTD'
      ? new Date(referenceDate.getFullYear(), 0, 1)
      : new Date(referenceDate.getFullYear(), referenceDate.getMonth() - monthCount + 1, 1);

  for (let index = 0; index < monthCount; index += 1) {
    const cursor = new Date(start.getFullYear(), start.getMonth() + index, 1);
    buckets.push({
      key: monthKey(cursor),
      label: formatMonthLabel(cursor, range === 'YTD'),
      outings: 0,
    });
  }

  trips.forEach((trip) => {
    const date = parseTripDate(trip.tripDate);
    if (!date || date < start || date > referenceDate) {
      return;
    }

    const bucket = buckets.find((item) => item.key === monthKey(date));
    if (bucket) {
      bucket.outings += 1;
    }
  });

  return buckets;
}

function latestTripDate(trips: Trip[]) {
  const dates = trips
    .map((trip) => parseTripDate(trip.tripDate))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime());

  return dates[0];
}

function parseTripDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfWeekMonday(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

function isoDateKey(date: Date) {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date
    .getDate()
    .toString()
    .padStart(2, '0')}`;
}

function formatMonthLabel(date: Date, omitYear: boolean) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: omitYear ? undefined : '2-digit',
  });
}

function trendPeriodLabel(range: TrendRange) {
  return range === '1M' ? 'Weekly cadence' : 'Monthly cadence';
}

function trendLabelSample(buckets: { label: string; outings: number }[]) {
  if (buckets.length <= 6) {
    return buckets;
  }

  const indexes = new Set([0, Math.floor((buckets.length - 1) / 2), buckets.length - 1]);
  if (buckets.length > 12) {
    indexes.add(Math.floor((buckets.length - 1) / 3));
    indexes.add(Math.floor(((buckets.length - 1) * 2) / 3));
  }

  return buckets.filter((_, index) => indexes.has(index));
}

function buildLineChartStyle(buckets: { label: string; outings: number }[]): CSSProperties {
  const width = 560;
  const height = 170;
  const paddingX = 42;
  const paddingY = 24;
  const maxValue = Math.max(...buckets.map((bucket) => bucket.outings), 1);
  const yTicks = [0, Math.ceil(maxValue / 2), maxValue].filter((value, index, values) => values.indexOf(value) === index);
  const points = buckets.map((bucket, index) => {
    const x = buckets.length === 1
      ? width / 2
      : paddingX + (index / (buckets.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - (bucket.outings / maxValue) * (height - paddingY * 2);
    return { x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${paddingX},${height - paddingY} ${polyline} ${width - paddingX},${height - paddingY}`;
  const circles = points
    .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5" fill="#176b75" stroke="#ffffff" stroke-width="3" />`)
    .join('');
  const grid = yTicks
    .map((tick) => {
      const y = height - paddingY - (tick / maxValue) * (height - paddingY * 2);
      return `<line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" stroke="#d7e4e5" stroke-width="1" /><text x="${paddingX - 10}" y="${y + 4}" text-anchor="end" fill="#557174" font-size="12" font-family="Arial">${tick}</text>`;
    })
    .join('');

  return {
    backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
        ${grid}
        <polyline fill="#dbeff1" fill-opacity="0.85" stroke="none" points="${area}" />
        <polyline fill="none" stroke="#176b75" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${polyline}" />
        ${circles}
        <text x="${paddingX}" y="${height - 5}" fill="#557174" font-size="12" font-family="Arial">Outings per period</text>
      </svg>`,
    )}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '100% 100%',
    height,
    width: '100%',
  };
}

function buildDonutStyle(rows: [string, number][]): CSSProperties {
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  let cursor = 0;
  const stops = rows.map(([, count], index) => {
    const start = cursor;
    cursor += total > 0 ? (count / total) * 100 : 0;
    const color = chartColors[index % chartColors.length];
    return `${color} ${start}% ${cursor}%`;
  });

  return {
    background: `conic-gradient(${stops.join(', ')})`,
    borderRadius: '50%',
    height: 132,
    width: 132,
  };
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

const initialProfile: Profile = {
  id: 'mock-profile',
  email: 'tester@seadays.local',
  displayName: 'SeaDays Tester',
};

const waterTypeLabels: Record<WaterBodyType, string> = {
  inland: 'Inshore',
  near_coastal: 'Near Coastal',
  offshore: 'Offshore',
  great_lakes: 'Great Lakes',
  unknown: 'Unknown',
};

const chartColors = ['#176b75', '#7c9a42', '#d48b36', '#8a6fb0', '#4f7fb8', '#b45562'];

const navItems: { key: ActiveTab; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'view-dashboard-outline' },
  { key: 'logs', label: 'Logs', icon: 'notebook-outline' },
  { key: 'vessels', label: 'Vessels', icon: 'ferry' },
  { key: 'progress', label: 'Progress', icon: 'chart-timeline-variant' },
  { key: 'account', label: 'Account', icon: 'account-circle-outline' },
];

const infoPages: Record<InfoPageKey, { title: string; sections: { heading: string; body: string }[] }> = {
  about: {
    title: 'About SeaDays',
    sections: [
      {
        heading: 'What we do',
        body: 'SeaDays helps mariners record vessel time, organize trip history, and prepare for credential application workflows such as USCG OUPV / Six-Pack sea service documentation.',
      },
      {
        heading: 'Current status',
        body: 'This is an early testing product. Logged data should be reviewed by the user before relying on it for any official application or submission.',
      },
    ],
  },
  privacy: {
    title: 'Privacy',
    sections: [
      {
        heading: 'Data we expect to collect',
        body: 'Account details, vessel details, trip logs, location and water body information, app usage information, and support communications may be processed to provide the service.',
      },
      {
        heading: 'How we use data',
        body: 'We use data to operate SeaDays, save logs, calculate progress, troubleshoot issues, improve the product, and prepare user-requested exports or summaries.',
      },
      {
        heading: 'Production review needed',
        body: 'This starter notice must be reviewed before public launch, especially before adding payments, analytics, exports, third-party integrations, or marketing email.',
      },
    ],
  },
  terms: {
    title: 'Terms',
    sections: [
      {
        heading: 'No government affiliation',
        body: 'SeaDays is not affiliated with, endorsed by, or operated by the United States Coast Guard or any government agency.',
      },
      {
        heading: 'User responsibility',
        body: 'Users are responsible for the accuracy of their records and for confirming that any generated forms or summaries meet current submission requirements.',
      },
      {
        heading: 'No professional advice',
        body: 'SeaDays provides recordkeeping tools, not legal, licensing, maritime, or regulatory advice.',
      },
    ],
  },
  accessibility: {
    title: 'Accessibility',
    sections: [
      {
        heading: 'Commitment',
        body: 'We intend SeaDays to be usable by as many people as practical, including people using keyboard navigation, screen readers, zoom, and high contrast settings.',
      },
      {
        heading: 'Standard',
        body: 'Our working target is WCAG 2.2 AA where practical for the web app, with platform accessibility checks for iOS and Android before external launch.',
      },
      {
        heading: 'Feedback',
        body: 'If something is hard to see, navigate, read, or operate, contact support so we can prioritize a fix.',
      },
    ],
  },
  contact: {
    title: 'Contact & Support',
    sections: [
      {
        heading: 'Support',
        body: 'For testing, use the project owner support channel. Before public launch, this page should include a monitored support email and response expectations.',
      },
      {
        heading: 'Compliance requests',
        body: 'Before launch, this page should include a way to request privacy help, accessibility help, account deletion, and data export.',
      },
    ],
  },
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

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id ?? ''),
    email: String(row.email ?? ''),
    displayName: row.display_name ? String(row.display_name) : undefined,
  };
}

class ApiRepository implements Repository {
  label = 'Supabase API';

  constructor(private readonly session: Session) {}

  async loadDashboard(): Promise<DashboardData> {
    const [profile, vessels, trips] = await Promise.all([
      this.request('/v1/profile'),
      this.request('/v1/vessels'),
      this.request('/v1/trips'),
    ]);
    return {
      profile: mapProfile(profile as Record<string, unknown>),
      vessels: (vessels as Record<string, unknown>[]).map(mapVessel),
      trips: (trips as Record<string, unknown>[]).map(mapTrip),
    };
  }

  async updateProfileDisplayName(displayName: string): Promise<Profile> {
    const updated = await this.request('/v1/profile', {
      method: 'PATCH',
      body: {
        display_name: displayName.trim() || null,
      },
    });

    return mapProfile(updated as Record<string, unknown>);
  }

  async saveVessel(draft: VesselDraft): Promise<Vessel> {
    const created = await this.request('/v1/vessels', {
      method: 'POST',
      body: makeVesselPayload(draft),
    });

    return mapVessel(created as Record<string, unknown>);
  }

  async updateVessel(vesselId: string, draft: VesselDraft): Promise<Vessel> {
    const updated = await this.request(`/v1/vessels/${vesselId}`, {
      method: 'PATCH',
      body: makeVesselPayload(draft),
    });

    return mapVessel(updated as Record<string, unknown>);
  }

  async saveTrip(draft: TripDraft): Promise<void> {
    await this.request('/v1/trips', {
      method: 'POST',
      body: makeTripPayload(draft),
    });
  }

  async updateTrip(tripId: string, draft: TripDraft): Promise<void> {
    await this.request(`/v1/trips/${tripId}`, {
      method: 'PATCH',
      body: makeTripPayload(draft),
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
  private profile = initialProfile;
  private vessels = initialVessels;
  private trips = initialTrips;

  async loadDashboard(): Promise<DashboardData> {
    return { profile: this.profile, vessels: this.vessels, trips: this.trips };
  }

  async updateProfileDisplayName(displayName: string): Promise<Profile> {
    this.profile = {
      ...this.profile,
      displayName: displayName.trim() || undefined,
    };

    return this.profile;
  }

  async saveVessel(draft: VesselDraft): Promise<Vessel> {
    const vessel = this.vesselFromDraft(`vessel-${Date.now()}`, draft);
    this.vessels = [vessel, ...this.vessels];
    return vessel;
  }

  async updateVessel(vesselId: string, draft: VesselDraft): Promise<Vessel> {
    const updated = this.vesselFromDraft(vesselId, draft);
    this.vessels = this.vessels.map((vessel) => (vessel.id === vesselId ? updated : vessel));
    return updated;
  }

  private vesselFromDraft(id: string, draft: VesselDraft): Vessel {
    return {
      id,
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

  async updateTrip(tripId: string, draft: TripDraft): Promise<void> {
    this.trips = this.trips.map((trip) =>
      trip.id === tripId
        ? {
            ...trip,
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
          }
        : trip,
    );
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showVesselModal, setShowVesselModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [infoPage, setInfoPage] = useState<InfoPageKey | null>(null);
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
      setProfile(data.profile);
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

  const progress = useMemo<SummaryMetrics>(() => {
    const totalDays = trips.reduce((sum, trip) => sum + trip.dayCount, 0);
    const totalEntries = trips.length;
    const totalHours = trips.reduce((sum, trip) => sum + (trip.underwayHours ?? 0), 0);
    const totalLoggedDays = trips.reduce((sum, trip) => sum + (trip.underwayHours && trip.underwayHours > 0 ? 1 : 0), 0);
    const recentDays = totalDays;
    const nearCoastalDays = trips
      .filter((trip) => trip.waterBodyType === 'near_coastal' || trip.waterBodyType === 'offshore')
      .reduce((sum, trip) => sum + trip.dayCount, 0);
    const lastTrip = [...trips].sort((a, b) => b.tripDate.localeCompare(a.tripDate))[0];
    const qualifyingRate = percent(totalDays, totalEntries);
    const missingDataCount = trips.filter(tripHasMissingExportData).length;
    const signatureNeededCount = trips.filter((trip) => {
      const vessel = vessels.find((item) => item.id === trip.vesselId);
      return vesselNeedsOwnerSignature(vessel);
    }).length;
    const exportReadyCount = Math.max(totalEntries - missingDataCount, 0);
    const exportReadiness = percent(exportReadyCount, totalEntries);

    return {
      totalDays,
      totalEntries,
      totalHours,
      totalLoggedDays,
      recentDays,
      nearCoastalDays,
      vesselCount: vessels.length,
      averageHours: totalEntries > 0 ? totalHours / totalEntries : 0,
      lastTripDate: lastTrip?.tripDate ?? 'None',
      qualifyingRate,
      missingDataCount,
      signatureNeededCount,
      exportReadyCount,
      exportReadiness,
      totalRemaining: Math.max(360 - totalDays, 0),
      progressValue: Math.min(totalDays / 360, 1),
    };
  }, [trips, vessels]);

  async function saveTrip(draft: TripDraft) {
    showToast('Saving trip...', 'info', false);
    try {
      if (editingTrip) {
        await repository.updateTrip(editingTrip.id, draft);
      } else {
        await repository.saveTrip(draft);
      }
      setShowTripModal(false);
      setEditingTrip(null);
      await loadDashboard();
      showToast(editingTrip ? 'Trip updated.' : 'Trip logged.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      showToast(`Trip save failed: ${message}`, 'error');
      Alert.alert('Save failed', message);
    }
  }

  async function saveVessel(draft: VesselDraft) {
    showToast('Saving vessel...', 'info', false);
    try {
      const vessel = editingVessel
        ? await repository.updateVessel(editingVessel.id, draft)
        : await repository.saveVessel(draft);
      setShowVesselModal(false);
      setEditingVessel(null);
      setSelectedVessel(vessel);
      setActiveTab('vessels');
      await loadDashboard();
      showToast(`${vessel.displayName ?? vessel.name} ${editingVessel ? 'updated' : 'saved'}.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      showToast(`Vessel save failed: ${message}`, 'error');
      Alert.alert('Vessel save failed', message);
    }
  }

  async function saveDisplayName(displayName: string) {
    showToast('Saving display name...', 'info', false);
    try {
      const updatedProfile = await repository.updateProfileDisplayName(displayName);
      setProfile(updatedProfile);
      showToast('Display name updated.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      showToast(`Profile save failed: ${message}`, 'error');
      Alert.alert('Profile save failed', message);
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

        <View style={styles.ribbon}>
          {navItems.map((item) => {
            const selected = activeTab === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.ribbonButton, selected && styles.ribbonButtonActive]}
                onPress={() => {
                  setActiveTab(item.key);
                  if (item.key !== 'vessels') {
                    setSelectedVessel(null);
                  }
                }}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={20}
                  color={selected ? '#ffffff' : '#176b75'}
                />
                <Text style={[styles.ribbonButtonText, selected && styles.ribbonButtonTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'dashboard' ? (
          <>
          <View style={styles.progressPanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Dashboard</Text>
            <Text style={styles.panelBadge}>{progress.totalDays.toFixed(1)} / 360 days</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress.progressValue * 100}%` }]} />
          </View>
          <View style={styles.metricGrid}>
            <Metric label="Qualifying sea days" value={progress.totalDays.toFixed(1)} />
            <Metric label="Total outings" value={progress.totalLoggedDays.toFixed(0)} />
            <Metric label="Hours logged" value={progress.totalHours.toFixed(1)} />
            <Metric label="Export ready" value={`${progress.exportReadiness}%`} />
            <Metric label="Owner signatures" value={progress.signatureNeededCount.toString()} />
            <Metric label="Last outing" value={progress.lastTripDate} />
          </View>
          <View style={styles.dashboardGrid}>
            <TrendChart trips={trips} />
            <BreakdownChart
              title="Propulsion"
              items={vessels.map((vessel) => propulsionLabels[vessel.propulsionType] ?? vessel.propulsionType)}
            />
            <BreakdownChart
              title="Water type"
              items={trips.map((trip) => waterTypeLabels[trip.waterBodyType] ?? trip.waterBodyType)}
            />
            <MetricPanel
              title="Interesting"
              rows={[
                ['Remaining days', progress.totalRemaining.toFixed(1)],
                ['Missing data', progress.missingDataCount.toString()],
                ['Known vessels', progress.vesselCount.toString()],
              ]}
            />
          </View>
        </View>

          </>
        ) : activeTab === 'logs' ? (
          <LogsPage
            trips={trips}
            vessels={vessels}
            loading={loading}
            onAdd={() => setShowTripModal(true)}
            onEdit={(trip) => {
              setEditingTrip(trip);
              setShowTripModal(true);
            }}
          />
        ) : activeTab === 'vessels' ? (
          <VesselsPage
            vessels={vessels}
            selectedVessel={selectedVessel}
            loading={loading}
            onBack={() => setSelectedVessel(null)}
            onAdd={() => {
              setSelectedVessel(null);
              setEditingVessel(null);
              setShowVesselModal(true);
            }}
            onSelect={setSelectedVessel}
            onEdit={(vessel) => {
              setEditingVessel(vessel);
              setShowVesselModal(true);
            }}
          />
        ) : activeTab === 'progress' ? (
          <ProgressPage progress={progress} trips={trips} vessels={vessels} />
        ) : (
          <AccountPage
            profile={profile}
            repositoryLabel={repository.label}
            onOpenInfo={setInfoPage}
            onSaveDisplayName={saveDisplayName}
            onSignOut={onSignOut}
          />
        )}
        <InfoFooter onOpen={setInfoPage} />
      </ScrollView>

      <TripModal
        visible={showTripModal}
        onClose={() => {
          setShowTripModal(false);
          setEditingTrip(null);
        }}
        onSave={saveTrip}
        vessels={vessels}
        editingTrip={editingTrip}
        onCreateVessel={() => {
          setShowTripModal(false);
          setEditingTrip(null);
          setEditingVessel(null);
          setShowVesselModal(true);
        }}
      />
      <VesselModal
        visible={showVesselModal}
        onClose={() => {
          setShowVesselModal(false);
          setEditingVessel(null);
        }}
        onSave={saveVessel}
        editingVessel={editingVessel}
      />
      <InfoModal pageKey={infoPage} onClose={() => setInfoPage(null)} />
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

function MetricPanel({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <View style={styles.chartPanel}>
      <Text style={styles.chartTitle}>{title}</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.metricRow}>
          <Text style={styles.metricLabel}>{label}</Text>
          <Text style={styles.metricRowValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function TrendChart({ trips }: { trips: Trip[] }) {
  const [range, setRange] = useState<TrendRange>('YTD');
  const buckets = useMemo(() => buildTrendBuckets(trips, range), [range, trips]);
  const lineStyle = useMemo(() => buildLineChartStyle(buckets), [buckets]);
  const labelSample = useMemo(() => trendLabelSample(buckets), [buckets]);
  const totalOutings = buckets.reduce((sum, bucket) => sum + bucket.outings, 0);
  const peakOutings = Math.max(...buckets.map((bucket) => bucket.outings), 0);
  const latestOutings = buckets[buckets.length - 1]?.outings ?? 0;

  return (
    <View style={[styles.chartPanel, styles.chartPanelWide]}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Outing Frequency</Text>
          <Text style={styles.chartMeta}>{trendPeriodLabel(range)}</Text>
        </View>
        <View style={styles.rangeSelector}>
          {trendRangeOptions.map((option) => {
            const selected = option.key === range;
            return (
              <Pressable
                key={option.key}
                style={[styles.rangeButton, selected && styles.rangeButtonActive]}
                onPress={() => setRange(option.key)}
              >
                <Text style={[styles.rangeButtonText, selected && styles.rangeButtonTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.trendStatRow}>
        <View style={styles.trendStat}>
          <Text style={styles.metricLabel}>Range total</Text>
          <Text style={styles.trendStatValue}>{totalOutings}</Text>
        </View>
        <View style={styles.trendStat}>
          <Text style={styles.metricLabel}>Peak period</Text>
          <Text style={styles.trendStatValue}>{peakOutings}</Text>
        </View>
        <View style={styles.trendStat}>
          <Text style={styles.metricLabel}>Latest period</Text>
          <Text style={styles.trendStatValue}>{latestOutings}</Text>
        </View>
      </View>
      <View style={styles.lineChartShell}>
        {Platform.OS === 'web'
          ? createElement('div', { style: lineStyle })
          : <View style={styles.lineFallback} />}
      </View>
      <View style={styles.trendLabels}>
        {labelSample.map((bucket) => (
          <View key={bucket.label} style={styles.trendLabelItem}>
            <Text style={styles.trendLabel}>{bucket.label}</Text>
            <Text style={styles.trendValue}>{bucket.outings} outing{bucket.outings === 1 ? '' : 's'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BreakdownChart({ title, items }: { title: string; items: string[] }) {
  const rows = useMemo(() => {
    const counts = items.reduce<Record<string, number>>((result, item) => {
      const label = item || 'Unknown';
      result[label] = (result[label] ?? 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [items]);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  const donut = useMemo(() => buildDonutStyle(rows), [rows]);

  return (
    <View style={styles.chartPanel}>
      <Text style={styles.chartTitle}>{title}</Text>
      {rows.length === 0 ? <Text style={styles.emptyText}>No data yet.</Text> : null}
      {rows.length > 0 ? (
        <View style={styles.pieLayout}>
          <View style={styles.pieWrap}>
            {Platform.OS === 'web'
              ? createElement('div', {
                  style: donut,
                })
              : <View style={styles.pieFallback} />}
            <View style={styles.pieCenter}>
              <Text style={styles.pieCenterValue}>{total}</Text>
              <Text style={styles.pieCenterLabel}>items</Text>
            </View>
          </View>
        </View>
      ) : null}
      {rows.map(([label, count]) => {
        const value = percent(count, total);
        const color = chartColors[rows.findIndex(([rowLabel]) => rowLabel === label) % chartColors.length];
        return (
          <View key={label} style={styles.breakdownRow}>
            <View style={styles.breakdownLabelRow}>
              <View style={styles.legendLabel}>
                <View style={[styles.legendSwatch, { backgroundColor: color }]} />
                <Text style={styles.metricLabel}>{label}</Text>
              </View>
              <Text style={styles.metricLabel}>{value}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function LogsPage({
  trips,
  vessels,
  loading,
  onAdd,
  onEdit,
}: {
  trips: Trip[];
  vessels: Vessel[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (trip: Trip) => void;
}) {
  const qualifying = trips.filter((trip) => trip.dayCount > 0).length;
  const missing = trips.filter(tripHasMissingExportData).length;

  return (
    <View style={styles.tabPage}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Logs</Text>
          <Text style={styles.sectionSubtitle}>Review, edit, and prepare sea-service entries.</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={onAdd}>
          <MaterialCommunityIcons name="plus" size={18} color="#ffffff" />
          <Text style={styles.primaryButtonText}>Log Trip</Text>
        </Pressable>
      </View>

      <View style={styles.metricGrid}>
        <Metric label="Entries" value={trips.length.toString()} />
        <Metric label="Qualifying" value={qualifying.toString()} />
        <Metric label="Needs review" value={missing.toString()} />
      </View>

      {loading ? <ActivityIndicator color="#176b75" /> : null}
      {!loading && trips.length === 0 ? <Text style={styles.emptyText}>No trips yet.</Text> : null}

      {trips.map((trip) => (
        <TripListRow
          key={trip.id}
          trip={trip}
          vessel={vessels.find((item) => item.id === trip.vesselId)}
          onPress={() => onEdit(trip)}
        />
      ))}
    </View>
  );
}

function TripListRow({ trip, vessel, onPress }: { trip: Trip; vessel?: Vessel; onPress: () => void }) {
  return (
    <Pressable style={styles.tripRow} onPress={onPress}>
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
      <View style={styles.tripActionColumn}>
        <Text style={styles.dayCount}>{trip.dayCount.toFixed(1)} d</Text>
        <MaterialCommunityIcons name="pencil" size={18} color="#176b75" />
      </View>
    </Pressable>
  );
}

function ProgressPage({ progress, trips, vessels }: { progress: SummaryMetrics; trips: Trip[]; vessels: Vessel[] }) {
  return (
    <View style={styles.tabPage}>
      <View style={styles.progressPanel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>OUPV / Six-Pack Progress</Text>
          <Text style={styles.panelBadge}>{Math.round(progress.progressValue * 100)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress.progressValue * 100}%` }]} />
        </View>
        <View style={styles.metricGrid}>
          <Metric label="Qualifying days" value={progress.totalDays.toFixed(1)} />
          <Metric label="Remaining" value={progress.totalRemaining.toFixed(1)} />
          <Metric label="Hours" value={progress.totalHours.toFixed(1)} />
          <Metric label="Coastal+" value={progress.nearCoastalDays.toFixed(1)} />
        </View>
      </View>

      <View style={styles.dashboardGrid}>
        <MetricPanel
          title="Export Readiness"
          rows={[
            ['Ready logs', progress.exportReadyCount.toString()],
            ['Needs data review', progress.missingDataCount.toString()],
            ['Readiness', `${progress.exportReadiness}%`],
          ]}
        />
        <MetricPanel
          title="Owner Signatures"
          rows={[
            ['Likely needed', progress.signatureNeededCount.toString()],
            ['Known vessels', vessels.length.toString()],
            ['Logged trips', trips.length.toString()],
          ]}
        />
        <MetricPanel
          title="Credential Signals"
          rows={[
            ['Qualifying rate', `${progress.qualifyingRate}%`],
            ['Average hours', progress.averageHours.toFixed(1)],
            ['Last outing', progress.lastTripDate],
          ]}
        />
      </View>
    </View>
  );
}

function AccountPage({
  profile,
  repositoryLabel,
  onOpenInfo,
  onSaveDisplayName,
  onSignOut,
}: {
  profile: Profile | null;
  repositoryLabel: string;
  onOpenInfo: (page: InfoPageKey) => void;
  onSaveDisplayName: (displayName: string) => Promise<void>;
  onSignOut?: () => void;
}) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? '');
  }, [profile?.displayName]);

  async function submitDisplayName() {
    setSaving(true);
    try {
      await onSaveDisplayName(displayName);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.tabPage}>
      <View style={styles.progressPanel}>
        <Text style={styles.panelTitle}>Account</Text>
        <Text style={styles.sectionSubtitle}>Manage your SeaDays profile, support, and compliance pages.</Text>
        <View style={styles.accountForm}>
          <LabeledInput
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How SeaDays should greet you"
          />
          <Pressable style={styles.primaryButton} onPress={submitDisplayName} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <MaterialCommunityIcons name="content-save-outline" size={18} color="#ffffff" />
            )}
            <Text style={styles.primaryButtonText}>Save</Text>
          </Pressable>
        </View>
        <View style={styles.metricGrid}>
          <Metric label="Display name" value={profile?.displayName || 'Not set'} />
          <Metric label="Email" value={profile?.email || 'Not loaded'} />
          <Metric label="Workspace" value={repositoryLabel} />
          <Metric label="Theme" value="Light" />
          <Metric label="Status" value="Testing" />
        </View>
      </View>
      <View style={styles.dashboardGrid}>
        {(['about', 'privacy', 'terms', 'accessibility', 'contact'] as InfoPageKey[]).map((key) => (
          <Pressable key={key} style={styles.accountLink} onPress={() => onOpenInfo(key)}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color="#176b75" />
            <Text style={styles.accountLinkText}>{infoPages[key].title}</Text>
          </Pressable>
        ))}
      </View>
      {onSignOut ? (
        <Pressable style={styles.secondaryActionButton} onPress={onSignOut}>
          <MaterialCommunityIcons name="logout" size={20} color="#176b75" />
          <Text style={styles.secondaryActionText}>Sign out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function VesselsPage({
  vessels,
  selectedVessel,
  loading,
  onBack,
  onAdd,
  onSelect,
  onEdit,
}: {
  vessels: Vessel[];
  selectedVessel: Vessel | null;
  loading: boolean;
  onBack: () => void;
  onAdd: () => void;
  onSelect: (vessel: Vessel) => void;
  onEdit: (vessel: Vessel) => void;
}) {
  if (selectedVessel) {
    return <VesselDetail vessel={selectedVessel} onBack={onBack} onEdit={() => onEdit(selectedVessel)} />;
  }

  return (
    <View style={styles.tabPage}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Vessels</Text>
        <Pressable style={styles.primaryButton} onPress={onAdd}>
          <MaterialCommunityIcons name="plus" size={18} color="#ffffff" />
          <Text style={styles.primaryButtonText}>Add Vessel</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color="#176b75" /> : null}
      {vessels.length === 0 && !loading ? <Text style={styles.emptyText}>Add a frequent vessel before logging trips.</Text> : null}
      {vessels.map((vessel) => (
        <Pressable key={vessel.id} style={styles.vesselRow} onPress={() => onSelect(vessel)}>
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
          <Pressable style={styles.iconButtonSmall} onPress={() => onEdit(vessel)}>
            <MaterialCommunityIcons name="pencil" size={18} color="#176b75" />
          </Pressable>
        </Pressable>
      ))}
    </View>
  );
}

function VesselDetail({ vessel, onBack, onEdit }: { vessel: Vessel; onBack: () => void; onEdit: () => void }) {
  const primaryIdentifier = vessel.identifiers?.find((identifier) => identifier.isPrimary) ?? vessel.identifiers?.[0];

  return (
    <View style={styles.tabPage}>
      <View style={styles.detailHeader}>
        <Pressable style={styles.secondaryIconButton} onPress={onBack}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#176b75" />
        </Pressable>
        <View style={styles.tripBody}>
          <Text style={styles.sectionTitle}>{vessel.displayName ?? vessel.name}</Text>
          <Text style={styles.tripMeta}>{vessel.make || 'Unknown make'} {vessel.model || ''}</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={onEdit}>
          <MaterialCommunityIcons name="pencil" size={18} color="#ffffff" />
          <Text style={styles.primaryButtonText}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.detailGrid}>
        <DetailItem label="Ownership" value={ownershipLabels[vessel.ownershipType] ?? vessel.ownershipType} />
        <DetailItem label="Propulsion" value={propulsionLabels[vessel.propulsionType] ?? vessel.propulsionType} />
        <DetailItem label="Registration" value={primaryIdentifier?.identifierValue ?? 'Not set'} />
        <DetailItem label="Gross tons" value={vessel.grossTons == null ? 'Not set' : vessel.grossTons.toString()} />
        <DetailItem label="Length" value={formatFeetAndInches(vessel.lengthOverallInches)} />
        <DetailItem label="Beam" value={formatFeetAndInches(vessel.beamInches)} />
        <DetailItem label="Draft" value={formatFeetAndInches(vessel.draftInches)} />
      </View>
    </View>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function InfoFooter({ onOpen }: { onOpen: (page: InfoPageKey) => void }) {
  const links: { key: InfoPageKey; label: string }[] = [
    { key: 'about', label: 'About' },
    { key: 'privacy', label: 'Privacy' },
    { key: 'terms', label: 'Terms' },
    { key: 'accessibility', label: 'Accessibility' },
    { key: 'contact', label: 'Contact' },
  ];

  return (
    <View style={styles.footer}>
      <Text style={styles.footerBrand}>SeaDays</Text>
      <View style={styles.footerLinks}>
        {links.map((link) => (
          <Pressable key={link.key} style={styles.footerLink} onPress={() => onOpen(link.key)}>
            <Text style={styles.footerLinkText}>{link.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.footerNote}>Starter compliance pages for internal testing; review before public launch.</Text>
    </View>
  );
}

function InfoModal({ pageKey, onClose }: { pageKey: InfoPageKey | null; onClose: () => void }) {
  const page = pageKey ? infoPages[pageKey] : null;

  return (
    <Modal visible={Boolean(page)} animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{page?.title ?? ''}</Text>
            <Pressable style={styles.iconButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#0f3f46" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {page?.sections.map((section) => (
              <View key={section.heading} style={styles.infoSection}>
                <Text style={styles.infoHeading}>{section.heading}</Text>
                <Text style={styles.infoBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function TripModal({
  visible,
  onClose,
  onSave,
  vessels,
  editingTrip,
  onCreateVessel,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: TripDraft) => void;
  vessels: Vessel[];
  editingTrip?: Trip | null;
  onCreateVessel: () => void;
}) {
  const [vesselId, setVesselId] = useState(editingTrip?.vesselId || vessels[0]?.id || '');
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
    if (!visible) {
      return;
    }

    setVesselId(editingTrip?.vesselId || vessels[0]?.id || '');
    setTripDate(editingTrip?.tripDate || new Date().toISOString().slice(0, 10));
    setStartTime(timeFromIso(editingTrip?.startedAt, '10:00'));
    setEndTime(timeFromIso(editingTrip?.endedAt, '14:00'));
    setWaterBodyName(editingTrip?.waterBodyName ?? '');
    setServiceRole(editingTrip?.serviceRole ?? 'master');
    setPurposeType(editingTrip?.purposeType ?? 'recreational');
    setWaterBodyType(editingTrip?.waterBodyType ?? 'inland');
  }, [editingTrip, vessels, visible]);

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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingTrip ? 'Edit Trip' : 'Log Trip'}</Text>
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
              <Text style={styles.saveButtonText}>{editingTrip ? 'Update Trip' : 'Save Trip'}</Text>
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
  editingVessel,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: VesselDraft) => void;
  editingVessel?: Vessel | null;
}) {
  const [draft, setDraft] = useState<VesselDraft>(() => vesselToDraft(editingVessel));

  useEffect(() => {
    if (visible) {
      setDraft(vesselToDraft(editingVessel));
    }
  }, [editingVessel, visible]);

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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingVessel ? 'Edit Vessel' : 'Add Vessel'}</Text>
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
              <Text style={styles.saveButtonText}>{editingVessel ? 'Update Vessel' : 'Save Vessel'}</Text>
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
    backgroundColor: '#eef3f2',
  },
  centeredPage: {
    alignItems: 'center',
    backgroundColor: '#eef3f2',
    flex: 1,
    justifyContent: 'center',
  },
  page: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 1180,
    padding: 16,
    width: '100%',
  },
  toast: {
    alignSelf: 'center',
    borderRadius: 8,
    borderWidth: 1,
    left: 0,
    marginHorizontal: 'auto',
    maxWidth: 560,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'absolute',
    right: 0,
    top: 12,
    width: '90%',
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
    paddingVertical: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  ribbon: {
    backgroundColor: '#f8fbf7',
    borderColor: '#c7d8d3',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 6,
  },
  ribbonButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  ribbonButtonActive: {
    backgroundColor: '#0f6570',
  },
  ribbonButtonText: {
    color: '#176b75',
    fontWeight: '900',
  },
  ribbonButtonTextActive: {
    color: '#ffffff',
  },
  eyebrow: {
    color: '#5d746f',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: '#0b2f35',
    fontSize: 34,
    fontWeight: '800',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#f8fbf7',
    borderColor: '#c7d8d3',
    borderWidth: 1,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconButtonSmall: {
    alignItems: 'center',
    backgroundColor: '#f8fbf7',
    borderColor: '#c7d8d3',
    borderWidth: 1,
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  secondaryIconButton: {
    alignItems: 'center',
    backgroundColor: '#f8fbf7',
    borderColor: '#c7d8d3',
    borderWidth: 1,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  progressPanel: {
    backgroundColor: '#fbfdf8',
    borderColor: '#c5d6d2',
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
    backgroundColor: '#0f6570',
    height: '100%',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  metric: {
    backgroundColor: '#eef6f4',
    borderRadius: 8,
    flexBasis: 150,
    flexGrow: 1,
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
  dashboardGrid: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  chartPanel: {
    backgroundColor: '#fbfdf8',
    borderColor: '#c5d6d2',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 260,
    flexGrow: 1,
    padding: 12,
  },
  chartPanelWide: {
    flexBasis: 540,
    flexGrow: 2,
  },
  chartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  chartTitle: {
    color: '#103d43',
    fontSize: 15,
    fontWeight: '900',
  },
  chartMeta: {
    color: '#557174',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  rangeSelector: {
    backgroundColor: '#eef6f4',
    borderColor: '#d7e4e5',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  rangeButton: {
    borderRadius: 7,
    minHeight: 32,
    minWidth: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  rangeButtonActive: {
    backgroundColor: '#0f6570',
  },
  rangeButtonText: {
    color: '#176b75',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  rangeButtonTextActive: {
    color: '#ffffff',
  },
  trendStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  trendStat: {
    backgroundColor: '#eef6f4',
    borderRadius: 8,
    flexBasis: 130,
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  trendStatValue: {
    color: '#092f35',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  lineChartShell: {
    backgroundColor: '#ffffff',
    borderColor: '#d7e4e5',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lineFallback: {
    backgroundColor: '#d8e6e7',
    borderRadius: 8,
    height: 170,
  },
  trendLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  trendLabelItem: {
    backgroundColor: '#edf5f5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  trendLabel: {
    color: '#557174',
    fontSize: 11,
    fontWeight: '800',
  },
  trendValue: {
    color: '#092f35',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  breakdownRow: {
    marginTop: 10,
  },
  breakdownLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  pieLayout: {
    alignItems: 'center',
    marginTop: 14,
  },
  pieWrap: {
    alignItems: 'center',
    height: 132,
    justifyContent: 'center',
    position: 'relative',
    width: 132,
  },
  pieFallback: {
    backgroundColor: '#176b75',
    borderRadius: 66,
    height: 132,
    width: 132,
  },
  pieCenter: {
    alignItems: 'center',
    backgroundColor: '#f7fbfb',
    borderRadius: 42,
    height: 84,
    justifyContent: 'center',
    position: 'absolute',
    width: 84,
  },
  pieCenterValue: {
    color: '#092f35',
    fontSize: 22,
    fontWeight: '900',
  },
  pieCenterLabel: {
    color: '#557174',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  legendLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  legendSwatch: {
    borderRadius: 4,
    height: 12,
    width: 12,
  },
  metricRow: {
    alignItems: 'center',
    borderBottomColor: '#d7e4e5',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  metricRowValue: {
    color: '#092f35',
    fontSize: 16,
    fontWeight: '900',
  },
  tabPage: {
    gap: 14,
  },
  detailHeader: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d7e4e5',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailItem: {
    backgroundColor: '#ffffff',
    borderColor: '#d7e4e5',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 170,
    flexGrow: 1,
    padding: 14,
  },
  detailValue: {
    color: '#092f35',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    borderColor: '#d7e4e5',
    borderTopWidth: 1,
    gap: 10,
    marginTop: 18,
    paddingTop: 18,
  },
  footerBrand: {
    color: '#092f35',
    fontSize: 16,
    fontWeight: '900',
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  footerLink: {
    backgroundColor: '#e7f1f2',
    borderColor: '#c6dcdf',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  footerLinkText: {
    color: '#176b75',
    fontSize: 13,
    fontWeight: '900',
  },
  footerNote: {
    color: '#557174',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  infoSection: {
    backgroundColor: '#ffffff',
    borderColor: '#d7e4e5',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  infoHeading: {
    color: '#103d43',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  infoBody: {
    color: '#375a5e',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
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
  sectionSubtitle: {
    color: '#5d746f',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0f6570',
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
  secondaryActionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f8fbf7',
    borderColor: '#c7d8d3',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  secondaryActionText: {
    color: '#176b75',
    fontWeight: '900',
  },
  accountLink: {
    alignItems: 'center',
    backgroundColor: '#fbfdf8',
    borderColor: '#c5d6d2',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 220,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 10,
    minHeight: 58,
    padding: 14,
  },
  accountLinkText: {
    color: '#0b2f35',
    fontSize: 15,
    fontWeight: '900',
  },
  accountForm: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
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
  tripActionColumn: {
    alignItems: 'center',
    gap: 5,
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
    alignItems: 'center',
    backgroundColor: 'rgba(9, 47, 53, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalContainer: {
    backgroundColor: '#f4f7f7',
    borderColor: '#c6dcdf',
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: '92%',
    maxWidth: 720,
    overflow: 'hidden',
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    backgroundColor: '#f4f7f7',
    borderBottomColor: '#d7e4e5',
    borderBottomWidth: 1,
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
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    borderColor: '#bad2d5',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    marginTop: 8,
    paddingHorizontal: 10,
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
