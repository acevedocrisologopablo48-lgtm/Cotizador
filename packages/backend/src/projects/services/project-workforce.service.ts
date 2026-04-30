import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

const MAX_HOURS_PER_DAY = 24;
const MAX_DAILY_RATE = 100_000;

function toFiniteNumber(value: unknown, fallback?: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    if (fallback !== undefined) return fallback;
    throw new BadRequestException('Valor numérico inválido');
  }
  return n;
}

@Injectable()
export class ProjectWorkforceService {
  constructor(private firebase: FirebaseService) {}

  private col(projectId: string) {
    return this.firebase.db.collection('projects').doc(projectId).collection('workforceLogs');
  }

  private async assertProject(projectId: string) {
    const doc = await this.firebase.db.collection('projects').doc(projectId).get();
    if (!doc.exists || doc.data()?.deletedAt) {
      throw new NotFoundException('Proyecto no encontrado');
    }
  }

  async findByProject(projectId: string, params: { page?: number; pageSize?: number }) {
    const { page: rawPage, pageSize: rawPageSize } = params;
    const page = Number(rawPage) || 1;
    const pageSize = Number(rawPageSize) || 20;

    const query = this.col(projectId).orderBy('workDate', 'desc');
    const { docs, total } = await this.firebase.paginatedQuery(query, page, pageSize);
    const data = this.firebase.docsToArray(docs);

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async create(projectId: string, data: any, userId: string) {
    await this.assertProject(projectId);
    const hoursRegular = toFiniteNumber(data.hoursRegular ?? 8, 8);
    const hoursOvertime = toFiniteNumber(data.hoursOvertime ?? 0, 0);
    const dailyRate = toFiniteNumber(data.dailyRate);
    const overtimeRate = toFiniteNumber(data.overtimeRate ?? 0, 0);

    if (hoursRegular < 0 || hoursOvertime < 0 || dailyRate < 0 || overtimeRate < 0) {
      throw new BadRequestException('No se permiten valores negativos');
    }
    if (hoursRegular + hoursOvertime > MAX_HOURS_PER_DAY) {
      throw new BadRequestException(`Las horas no pueden superar ${MAX_HOURS_PER_DAY} por jornada`);
    }
    if (dailyRate > MAX_DAILY_RATE || overtimeRate > MAX_DAILY_RATE) {
      throw new BadRequestException('Tarifa diaria fuera de rango razonable');
    }

    const totalCost = (hoursRegular / 8) * dailyRate + (hoursOvertime / 8) * overtimeRate;

    const id = this.firebase.generateId();
    const docData = {
      ...data,
      registeredBy: userId,
      totalCost,
      createdAt: new Date(),
    };

    await this.col(projectId).doc(id).set(docData);
    return { id, ...docData };
  }
}
