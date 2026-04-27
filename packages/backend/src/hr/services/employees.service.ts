import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { EmployeeStatus } from '@fym/shared';

@Injectable()
export class EmployeesService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.db.collection('employees');
  }

  async findAll(status?: string, search?: string) {
    let query: FirebaseFirestore.Query = this.col;

    if (status) {
      query = query.where('status', '==', status).orderBy('fullName', 'asc');
    } else {
      query = query.orderBy('fullName', 'asc');
    }

    const snap = await query.get();
    let employees = this.firebase.docsToArray(snap.docs);

    // In-memory text search (Firestore doesn't support native full-text search)
    if (search) {
      const lower = search.toLowerCase();
      employees = employees.filter(
        (e: any) =>
          e.fullName?.toLowerCase().includes(lower) ||
          e.documentNumber?.includes(search) ||
          e.position?.toLowerCase().includes(lower) ||
          e.department?.toLowerCase().includes(lower),
      );
    }

    return employees;
  }

  async findOne(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Empleado no encontrado');
    return this.firebase.docToObj(doc);
  }

  async create(dto: CreateEmployeeDto, userId: string) {
    // Enforce unique documentNumber across all employees
    const existing = await this.col
      .where('documentNumber', '==', dto.documentNumber)
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new ConflictException(
        `Ya existe un empleado registrado con el documento ${dto.documentNumber}`,
      );
    }

    const id = this.firebase.generateId();
    const now = new Date();

    const docData = {
      ...dto,
      status: EmployeeStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    await this.col.doc(id).set(docData);
    return { id, ...docData };
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Empleado no encontrado');

    // If documentNumber is being changed, check uniqueness
    if (dto.documentNumber && dto.documentNumber !== doc.data()?.documentNumber) {
      const existing = await this.col
        .where('documentNumber', '==', dto.documentNumber)
        .limit(1)
        .get();
      if (!existing.empty) {
        throw new ConflictException(
          `Ya existe un empleado registrado con el documento ${dto.documentNumber}`,
        );
      }
    }

    const updateData = { ...dto, updatedAt: new Date() };
    await this.col.doc(id).update(updateData);

    return this.firebase.docToObj(await this.col.doc(id).get());
  }

  /** Soft-delete: marks employee as INACTIVE */
  async deactivate(id: string) {
    const doc = await this.col.doc(id).get();
    if (!doc.exists) throw new NotFoundException('Empleado no encontrado');

    await this.col.doc(id).update({
      status: EmployeeStatus.INACTIVE,
      updatedAt: new Date(),
    });

    return { id, status: EmployeeStatus.INACTIVE };
  }
}
