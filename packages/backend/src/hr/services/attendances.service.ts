import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { RegisterAttendanceDto } from '../dto/register-attendance.dto';
import { AttendanceType, TimesheetStatus } from '@fym/shared';

/** Returns today's date in Peru timezone (UTC-5) as YYYY-MM-DD */
function getPeruDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Returns ISO week string (YYYY-Wnn) for a date string */
function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thu.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
}

function limaDateAt(dateStr: string, hour: number, minute: number): Date {
  return new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-05:00`);
}

function roundToHalfHour(hours: number): number {
  return Math.round(hours * 2) / 2;
}

function roundAttendanceTime(value: Date, type: AttendanceType): Date {
  const rounded = new Date(value);
  const minutesFromStart = rounded.getHours() * 60 + rounded.getMinutes();
  const roundedMinutes =
    type === AttendanceType.CHECK_IN
      ? Math.ceil(minutesFromStart / 30) * 30
      : Math.floor(minutesFromStart / 30) * 30;

  rounded.setHours(0, roundedMinutes, 0, 0);
  return rounded;
}

function calculateWorkMetrics(date: string, checkInTime: Date, checkOutTime: Date) {
  const standardStart = limaDateAt(date, 8, 30);
  const standardEnd = limaDateAt(date, 17, 0);
  const graceStart = limaDateAt(date, 8, 45);
  const msWorked = Math.max(0, checkOutTime.getTime() - checkInTime.getTime());
  const rawHours = Math.round((msWorked / 3_600_000) * 100) / 100;
  const standardHours = Math.round(((standardEnd.getTime() - standardStart.getTime()) / 3_600_000) * 100) / 100;
  const fullStandardDay = checkInTime <= graceStart && checkOutTime >= standardEnd;
  const roundedHours = fullStandardDay ? standardHours : roundToHalfHour(rawHours);
  const overtimeRaw = Math.max(0, checkOutTime.getTime() - standardEnd.getTime()) / 3_600_000;
  const overtimeHours = overtimeRaw >= 1 ? roundToHalfHour(overtimeRaw) : 0;

  return {
    rawHours,
    hoursWorked: Math.max(0, roundedHours),
    regularHours: fullStandardDay ? standardHours : Math.min(roundedHours, standardHours),
    overtimeHours,
    paidDays: fullStandardDay || roundedHours >= 4 ? 1 : 0.5,
    attendancePolicy: {
      standardStart: '08:30',
      standardEnd: '17:00',
      graceUntil: '08:45',
      fullStandardDay,
      rounded: true,
      overtimeThresholdHours: 1,
    },
  };
}

@Injectable()
export class AttendancesService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('attendances');
  }

  private get timesheets() {
    return this.firebase.db.collection('timesheets');
  }

  async register(dto: RegisterAttendanceDto, userId: string) {
    // Validate employee exists and is active
    const empDoc = await this.firebase.db
      .collection('employees')
      .doc(dto.employeeId)
      .get();

    if (!empDoc.exists) {
      throw new NotFoundException('Empleado no encontrado');
    }
    if (empDoc.data()?.status !== 'ACTIVE') {
      throw new BadRequestException('El empleado no está activo');
    }

    const today = getPeruDate();
    const now = new Date();

    if (dto.type === AttendanceType.CHECK_IN) {
      return this.registerCheckIn(dto, userId, today, now);
    } else {
      return this.registerCheckOut(dto, userId, today, now);
    }
  }

  private async registerCheckIn(
    dto: RegisterAttendanceDto,
    userId: string,
    today: string,
    now: Date,
  ) {
    // Prevent double CHECK_IN on same day
    const existingIn = await this.col
      .where('employeeId', '==', dto.employeeId)
      .where('date', '==', today)
      .where('type', '==', AttendanceType.CHECK_IN)
      .limit(1)
      .get();

    if (!existingIn.empty) {
      throw new BadRequestException(
        'El empleado ya tiene una entrada registrada para hoy. Registre la salida primero.',
      );
    }

    const roundedNow = roundAttendanceTime(now, AttendanceType.CHECK_IN);
    const id = this.firebase.generateId();
    const docData = {
      employeeId: dto.employeeId,
      type: AttendanceType.CHECK_IN,
      timestamp: roundedNow,
      actualTimestamp: now,
      roundedTimestamp: roundedNow,
      photoUrl: dto.photoUrl,
      date: today,
      location: dto.location ?? null,
      notes: dto.notes ?? null,
      registeredBy: userId,
      createdAt: now,
    };

    await this.col.doc(id).set(docData);

    // Create pending timesheet for this day
    const existing = await this.timesheets
      .where('employeeId', '==', dto.employeeId)
      .where('date', '==', today)
      .limit(1)
      .get();

    if (existing.empty) {
      const tsId = this.firebase.generateId();
      await this.timesheets.doc(tsId).set({
        employeeId: dto.employeeId,
        date: today,
        month: today.substring(0, 7),
        week: getISOWeek(today),
        checkInId: id,
        checkOutId: null,
        checkInTime: roundedNow,
        actualCheckInTime: now,
        checkOutTime: null,
        actualCheckOutTime: null,
        hoursWorked: null,
        status: TimesheetStatus.INCOMPLETE,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { id, ...docData };
  }

  private async registerCheckOut(
    dto: RegisterAttendanceDto,
    userId: string,
    today: string,
    now: Date,
  ) {
    // Must have CHECK_IN today
    const checkInSnap = await this.col
      .where('employeeId', '==', dto.employeeId)
      .where('date', '==', today)
      .where('type', '==', AttendanceType.CHECK_IN)
      .limit(1)
      .get();

    if (checkInSnap.empty) {
      throw new BadRequestException(
        'No se encontró una entrada registrada para hoy. Registre la entrada primero.',
      );
    }

    // Prevent double CHECK_OUT on same day
    const existingOut = await this.col
      .where('employeeId', '==', dto.employeeId)
      .where('date', '==', today)
      .where('type', '==', AttendanceType.CHECK_OUT)
      .limit(1)
      .get();

    if (!existingOut.empty) {
      throw new BadRequestException(
        'El empleado ya tiene una salida registrada para hoy.',
      );
    }

    const checkInDoc = checkInSnap.docs[0];
    // Access raw Firestore Timestamp before going through docToObj
    const checkInTimestamp = checkInDoc.data().timestamp;
    const checkInTime: Date = checkInTimestamp?.toDate
      ? checkInTimestamp.toDate()
      : new Date(checkInTimestamp);

    const roundedNow = roundAttendanceTime(now, AttendanceType.CHECK_OUT);
    const id = this.firebase.generateId();
    const docData = {
      employeeId: dto.employeeId,
      type: AttendanceType.CHECK_OUT,
      timestamp: roundedNow,
      actualTimestamp: now,
      roundedTimestamp: roundedNow,
      photoUrl: dto.photoUrl,
      date: today,
      location: dto.location ?? null,
      notes: dto.notes ?? null,
      registeredBy: userId,
      createdAt: now,
    };

    await this.col.doc(id).set(docData);

    const workMetrics = calculateWorkMetrics(today, checkInTime, roundedNow);

    // Update the timesheet for this day
    const tsSnap = await this.timesheets
      .where('employeeId', '==', dto.employeeId)
      .where('date', '==', today)
      .limit(1)
      .get();

    if (!tsSnap.empty) {
      await this.timesheets.doc(tsSnap.docs[0].id).update({
        checkOutId: id,
        checkOutTime: roundedNow,
        actualCheckOutTime: now,
        ...workMetrics,
        status: TimesheetStatus.PRESENT,
        updatedAt: now,
      });
    }

    return { id, ...docData, ...workMetrics };
  }

  async findAll(
    employeeId?: string,
    dateFrom?: string,
    dateTo?: string,
    page = 1,
    pageSize = 30,
  ) {
    // Build query with the most selective equality filter first
    let query: FirebaseFirestore.Query = this.col;

    if (employeeId) {
      query = query.where('employeeId', '==', employeeId);
    }

    if (dateFrom) query = query.where('date', '>=', dateFrom);
    if (dateTo)   query = query.where('date', '<=', dateTo);

    query = query.orderBy('date', 'desc');

    const snap = await query.get();
    const all = this.firebase.docsToArray(snap.docs);

    const total = all.length;
    const start = (page - 1) * pageSize;
    const data = all.slice(start, start + pageSize);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
