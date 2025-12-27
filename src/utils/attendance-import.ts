import * as XLSX from 'xlsx';
import { ValidationError } from './errors';

export interface AttendanceImportRow {
  employeeCode?: string;
  fullName?: string;
  date?: string;
  checkInTime?: string;
  checkOutTime?: string;
  status?: string;
  leaveType?: string;
  notes?: string;
  [key: string]: any;
}

export interface ImportedAttendance {
  employeeCode: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:MM:SS
  checkOutTime?: string; // HH:MM:SS
  status?: string;
  leaveType?: string;
  notes?: string;
  errors?: string[];
}

/**
 * Parse Excel file and extract attendance data
 */
export function parseExcelFile(filePath: string): AttendanceImportRow[] {
  try {
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new ValidationError('Excel file is empty');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const data: AttendanceImportRow[] = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      throw new ValidationError('No data found in Excel file');
    }

    return data;
  } catch (error: any) {
    throw new ValidationError(`Failed to parse Excel file: ${error.message}`);
  }
}

/**
 * Validate and normalize date string
 */
function normalizeDate(dateStr: any): string | null {
  if (!dateStr) return null;

  // Handle Excel date serial numbers
  if (typeof dateStr === 'number') {
    // Excel epoch: January 1, 1900
    const excelDate = new Date((dateStr - 25569) * 86400 * 1000);
    return excelDate.toISOString().split('T')[0];
  }

  // Handle string dates
  const dateString = String(dateStr).trim();

  // Try DD/MM/YYYY format
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateString);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Try DD-MM-YYYY format
  const dmy2 = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(dateString);
  if (dmy2) {
    const [, day, month, year] = dmy2;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

/**
 * Validate and normalize time string (HH:MM or HH:MM:SS)
 */
function normalizeTime(timeStr: any): string | null {
  if (!timeStr) return null;

  const timeString = String(timeStr).trim();

  // Time format HH:MM:SS
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(timeString)) {
    const [h, m, s] = timeString.split(':').map(Number);
    if (h >= 0 && h < 24 && m >= 0 && m < 60 && s >= 0 && s < 60) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
        .toString()
        .padStart(2, '0')}`;
    }
  }

  // Time format HH:MM
  if (/^\d{1,2}:\d{2}$/.test(timeString)) {
    const [h, m] = timeString.split(':').map(Number);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
    }
  }

  return null;
}

/**
 * Validate attendance status
 */
function validateStatus(status: any): string | null {
  if (!status) return null;

  const statusString = String(status).toLowerCase().trim();
  const validStatuses = ['present', 'absent', 'late', 'leave', 'work_from_home'];

  // Direct match
  if (validStatuses.includes(statusString)) {
    return statusString;
  }

  // Vietnamese aliases
  const vietnameseMap: Record<string, string> = {
    'đủ công': 'present',
    'có mặt': 'present',
    'vắng mặt': 'absent',
    'không phép': 'absent',
    'đi muộn': 'late',
    muộn: 'late',
    'nghỉ phép': 'leave',
    nghỉ: 'leave',
    wfh: 'work_from_home',
    'work from home': 'work_from_home',
    'làm việc từ nhà': 'work_from_home',
  };

  return vietnameseMap[statusString] || null;
}

/**
 * Validate leave type
 */
function validateLeaveType(leaveType: any): string | null {
  if (!leaveType) return 'none';

  const typeString = String(leaveType).toLowerCase().trim();
  const validTypes = ['none', 'annual', 'sick', 'unpaid', 'other'];

  if (validTypes.includes(typeString)) {
    return typeString;
  }

  // Vietnamese aliases
  const vietnameseMap: Record<string, string> = {
    'không phải nghỉ': 'none',
    'nghỉ phép năm': 'annual',
    'phép năm': 'annual',
    phép: 'annual',
    'nghỉ ốm': 'sick',
    ốm: 'sick',
    bệnh: 'sick',
    'nghỉ không lương': 'unpaid',
    'không lương': 'unpaid',
    khác: 'other',
  };

  return vietnameseMap[typeString] || null;
}

/**
 * Map Excel columns to attendance properties
 */
function mapColumns(row: AttendanceImportRow): {
  employeeCode: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status?: string;
  leaveType?: string;
  notes?: string;
  errors: string[];
} {
  const errors: string[] = [];
  const result: {
    employeeCode: string;
    date: string;
    checkInTime?: string;
    checkOutTime?: string;
    status?: string;
    leaveType?: string;
    notes?: string;
    errors: string[];
  } = {
    employeeCode: '',
    date: '',
    checkInTime: undefined,
    checkOutTime: undefined,
    status: undefined,
    leaveType: undefined,
    notes: undefined,
    errors,
  };

  // Find and map employee code
  const codeFields = ['employee_code', 'mã_nv', 'mã nv', 'employee code', 'code'];
  const employeeCode = codeFields.map((field) => row[field]).find((val) => val);

  if (!employeeCode) {
    errors.push('Employee code is required');
  } else {
    result.employeeCode = String(employeeCode).trim();
  }

  // Find and map date
  const dateFields = ['date', 'ngày', 'ngay', 'ngày tháng', 'date_of_attendance'];
  const dateValue = dateFields.map((field) => row[field]).find((val) => val);

  const normalizedDate = normalizeDate(dateValue);
  if (!normalizedDate) {
    errors.push('Invalid date format. Use DD/MM/YYYY, YYYY-MM-DD, or Excel date');
  } else {
    result.date = normalizedDate;
  }

  // Map check-in time
  const checkInFields = ['check_in_time', 'giờ_vào', 'giờ vào', 'check in', 'check in time'];
  const checkInValue = checkInFields.map((field) => row[field]).find((val) => val);
  if (checkInValue) {
    const normalizedTime = normalizeTime(checkInValue);
    if (normalizedTime) {
      result.checkInTime = normalizedTime;
    }
  }

  // Map check-out time
  const checkOutFields = ['check_out_time', 'giờ_ra', 'giờ ra', 'check out', 'check out time'];
  const checkOutValue = checkOutFields.map((field) => row[field]).find((val) => val);
  if (checkOutValue) {
    const normalizedTime = normalizeTime(checkOutValue);
    if (normalizedTime) {
      result.checkOutTime = normalizedTime;
    }
  }

  // Map status
  const statusFields = ['status', 'trạng_thái', 'trạng thái'];
  const statusValue = statusFields.map((field) => row[field]).find((val) => val);
  if (statusValue) {
    const validatedStatus = validateStatus(statusValue);
    if (validatedStatus) {
      result.status = validatedStatus;
    }
  }

  // Map leave type
  const leaveFields = ['leave_type', 'loại_nghỉ', 'loại nghỉ', 'leave type', 'type'];
  const leaveValue = leaveFields.map((field) => row[field]).find((val) => val);
  if (leaveValue) {
    const validatedLeave = validateLeaveType(leaveValue);
    result.leaveType = validatedLeave || 'none';
  }

  // Map notes
  const noteFields = ['notes', 'ghi_chú', 'ghi chú', 'remarks', 'description'];
  const noteValue = noteFields.map((field) => row[field]).find((val) => val);
  if (noteValue) {
    result.notes = String(noteValue).trim().substring(0, 255);
  }

  return result;
}

/**
 * Process imported attendance data
 */
export function processImportData(rows: AttendanceImportRow[]): {
  valid: ImportedAttendance[];
  invalid: ImportedAttendance[];
} {
  const valid: ImportedAttendance[] = [];
  const invalid: ImportedAttendance[] = [];

  rows.forEach((row, index) => {
    const mapped = mapColumns(row);

    // Check for errors
    if (mapped.errors.length > 0 || !mapped.employeeCode || !mapped.date) {
      invalid.push({
        employeeCode: mapped.employeeCode || `Row ${index + 2}`,
        date: mapped.date || '',
        checkInTime: mapped.checkInTime,
        checkOutTime: mapped.checkOutTime,
        status: mapped.status,
        leaveType: mapped.leaveType,
        notes: mapped.notes,
        errors: [
          ...mapped.errors,
          ...(!mapped.employeeCode ? ['Missing employee code'] : []),
          ...(!mapped.date ? ['Invalid date'] : []),
        ],
      });
      return;
    }

    valid.push({
      employeeCode: mapped.employeeCode,
      date: mapped.date,
      checkInTime: mapped.checkInTime,
      checkOutTime: mapped.checkOutTime,
      status: mapped.status,
      leaveType: mapped.leaveType,
      notes: mapped.notes,
    });
  });

  return { valid, invalid };
}

/**
 * Main import function
 */
export async function importAttendanceFromFile(filePath: string): Promise<{
  valid: ImportedAttendance[];
  invalid: ImportedAttendance[];
  summary: {
    total: number;
    validCount: number;
    invalidCount: number;
  };
}> {
  const rows = parseExcelFile(filePath);
  const { valid, invalid } = processImportData(rows);

  return {
    valid,
    invalid,
    summary: {
      total: rows.length,
      validCount: valid.length,
      invalidCount: invalid.length,
    },
  };
}
