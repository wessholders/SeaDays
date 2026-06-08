import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
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
  lengthOverallInches?: number;
  beamInches?: number;
  propulsionType: string;
};

type Trip = {
  id: string;
  vesselId: string;
  tripDate: string;
  serviceRole: ServiceRole;
  purposeType: PurposeType;
  waterBodyName: string;
  waterBodyType: WaterBodyType;
  underwayHours: number;
  dayCount: number;
};

const initialVessels: Vessel[] = [
  {
    id: 'vessel-1',
    name: 'Sea Trial',
    displayName: 'Sea Trial',
    make: 'Parker',
    model: '2520',
    lengthOverallInches: 300,
    beamInches: 114,
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

export default function DashboardScreen() {
  const [vessels, setVessels] = useState(initialVessels);
  const [trips, setTrips] = useState(initialTrips);
  const [showTripModal, setShowTripModal] = useState(false);

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

  function saveTrip(draft: TripDraft) {
    const vessel = vessels.find((item) => item.name.toLowerCase() === draft.vesselName.trim().toLowerCase());
    const vesselId = vessel?.id ?? `vessel-${Date.now()}`;

    if (!vessel) {
      setVessels((current) => [
        ...current,
        {
          id: vesselId,
          name: draft.vesselName.trim(),
          displayName: draft.vesselName.trim(),
          propulsionType: 'outboard',
        },
      ]);
    }

    setTrips((current) => [
      {
        id: `trip-${Date.now()}`,
        vesselId,
        tripDate: draft.tripDate,
        serviceRole: draft.serviceRole,
        purposeType: draft.purposeType,
        waterBodyName: draft.waterBodyName.trim(),
        waterBodyType: draft.waterBodyType,
        underwayHours: draft.underwayHours,
        dayCount: draft.underwayHours >= 4 ? 1 : 0,
      },
      ...current,
    ]);
    setShowTripModal(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Mock workspace</Text>
            <Text style={styles.title}>SeaDays</Text>
          </View>
          <Pressable style={styles.iconButton} onPress={() => Alert.alert('Sync', 'Offline sync will connect here.')}>
            <MaterialCommunityIcons name="cloud-sync-outline" size={24} color="#0f3f46" />
          </Pressable>
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
                  {trip.waterBodyName || 'No water body'} - {trip.underwayHours.toFixed(1)} hours
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

type TripDraft = {
  vesselName: string;
  tripDate: string;
  serviceRole: ServiceRole;
  purposeType: PurposeType;
  waterBodyName: string;
  waterBodyType: WaterBodyType;
  underwayHours: number;
};

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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad';
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
  page: {
    padding: 16,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    justifyContent: 'space-between',
    gap: 12,
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
