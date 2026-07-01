export type Role = 'student' | 'teacher' | 'supervisor' | 'admin' | 'coordinator';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: Role;
  status?: 'active' | 'inactive' | 'rejected';
  first_login?: boolean;
  dob?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  updated_at?: string;
  assigned_class?: string;
  assigned_section?: string;
  subject?: string;
  class?: string;
  section?: string;
  roll_number?: string;
  password_pin?: string;
  createdAt: string;
}

export interface ApprovalRequest {
  request_id: string;
  request_type: 'create_teacher' | 'create_supervisor' | 'create_student' | 'bulk_students' | 'assign_teacher' | 'transfer_student' | 'deactivate_user' | 'delete_user' | 'attendance_correction' | 'other';
  requested_by: string; // coordinator username / name
  requested_by_uid: string;
  request_data: any;
  status: 'pending' | 'approved' | 'rejected';
  principal_remarks?: string;
  approved_by?: string;
  approved_by_uid?: string;
  approved_at?: string;
  createdAt: string;
}

export interface AuditLog {
  log_id: string;
  user_id: string; // uid or username
  user_name: string;
  role: string;
  action: string;
  timestamp: string;
  remarks?: string;
}

export interface Student {
  id: string;
  name: string;
  rollNo?: string;
  class: string;
  section: string;
  gender: 'Male' | 'Female';
  present: boolean;
  dob?: string;
}

export interface TimetableEntry {
  timetable_id: string;
  teacher_id: string;
  subject: string;
  class: string;
  section: string;
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  period_number: number;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  status: 'Pending Approval' | 'Approved';
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  updated_at: string;
}

export interface SubstituteAssignment {
  assignment_id: string;
  date: string; // YYYY-MM-DD
  period: number;
  class: string;
  section: string;
  subject: string;
  original_teacher_id: string;
  substitute_teacher_id: string;
  assigned_by: string;
  assigned_at: string; // ISO timestamp
}

export interface TeacherLeave {
  leave_id: string;
  teacher_id: string;
  date: string; // YYYY-MM-DD
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Attendance {
  attendance_id: string;
  date: string; // YYYY-MM-DD
  period: number;
  class: string;
  section: string;
  subject: string;
  teacher_id: string; // The teacher who submitted (original or substitute)
  student_details: { [studentId: string]: 'P' | 'A' };
  submitted_at: string; // ISO timestamp
}

export interface MealItem {
  name: string;
  category: 'Rice' | 'Dal' | 'Egg' | 'Vegetables' | 'Dessert' | 'Special';
  unit: 'kg' | 'units';
  perCapitaQuantity: number; // in kg or units per present student
}

export interface WeeklyMenu {
  day: string;
  items: string[];
  calories: string;
  protein: string;
  fiber: string;
  veggieTag: string;
  image: string;
}

export interface WastageEntry {
  item: string;
  prepared: number;
  consumed: number;
  remaining: number;
  wastePercentage: number;
  unit: string;
}

export interface DailyWastageReport {
  id: string;
  date: string;
  items: WastageEntry[];
  avgWastePercentage: number;
  mostWastedItem: string;
  mostWastedQty: number;
}

export interface StudentFeedback {
  id: string;
  date: string;
  studentName?: string;
  itemRatings: { [foodItem: string]: number }; // 1-5 stars
  serviceRatings: {
    taste: number;
    quality: number;
    temperature: number;
    behaviour: number;
    cleanliness: number;
  };
  comments: string;
}

export interface AttendanceReport {
  id: string;
  date: string;
  classStr: string;
  section: string;
  totalStudents: number;
  totalPresent: number;
  totalAbsent: number;
  attendancePercentage: number;
  studentDetails?: { [studentId: string]: 'P' | 'A' };
}

// Fixed Weekly Menu according to the instructions table
export const WEEKLY_MENU: WeeklyMenu[] = [
  {
    day: 'Monday',
    items: ['Rice', 'Egg Curry', 'Chikki'],
    calories: '640 kcal',
    protein: '24g',
    fiber: '8g',
    veggieTag: 'Local Egg tier',
    image: 'https://img.freepik.com/premium-photo/indian-cuisine-meals-served-banana-leaf-traditional-south-indian-cuisine_875825-50086.jpg?w=740'
  },
  {
    day: 'Tuesday',
    items: ['Pulihora', 'Tomato Dal', 'Boiled Egg'],
    calories: '610 kcal',
    protein: '22g',
    fiber: '6g',
    veggieTag: 'Traditional Sour Rice',
    image: 'https://img.freepik.com/premium-photo/indian-cuisine-meals-served-banana-leaf-traditional-south-indian-cuisine_875825-50086.jpg?w=740'
  },
  {
    day: 'Wednesday',
    items: ['Vegetable Rice', 'Aloo Kurma', 'Boiled Egg', 'Chikki'],
    calories: '720 kcal',
    protein: '26g',
    fiber: '10g',
    veggieTag: 'High Fiber Mix',
    image: 'https://img.freepik.com/premium-photo/indian-cuisine-meals-served-banana-leaf-traditional-south-indian-cuisine_875825-50086.jpg?w=740'
  },
  {
    day: 'Thursday',
    items: ['Khichdi', 'Tomato Chutney', 'Boiled Egg'],
    calories: '580 kcal',
    protein: '20g',
    fiber: '7g',
    veggieTag: 'Nutritious Lentils',
    image: 'https://img.freepik.com/premium-photo/indian-cuisine-meals-served-banana-leaf-traditional-south-indian-cuisine_875825-50086.jpg?w=740'
  },
  {
    day: 'Friday',
    items: ['Rice', 'Dal', 'Boiled Egg', 'Chikki'],
    calories: '630 kcal',
    protein: '23g',
    fiber: '8g',
    veggieTag: 'Simple Protein',
    image: 'https://img.freepik.com/premium-photo/indian-cuisine-meals-served-banana-leaf-traditional-south-indian-cuisine_875825-50086.jpg?w=740'
  },
  {
    day: 'Saturday',
    items: ['Rice', 'Sambar', 'Sweet Pongal'],
    calories: '690 kcal',
    protein: '18g',
    fiber: '5g',
    veggieTag: 'Weekend Special',
    image: 'https://img.freepik.com/premium-photo/indian-cuisine-meals-served-banana-leaf-traditional-south-indian-cuisine_875825-50086.jpg?w=740'
  }
];

// Predefined ingredients per capita (present student) in kg or units:
export const MEAL_ITEMS: MealItem[] = [
  { name: 'Rice', category: 'Rice', unit: 'kg', perCapitaQuantity: 0.150 }, // 150g
  { name: 'Dal', category: 'Dal', unit: 'kg', perCapitaQuantity: 0.040 }, // 40g
  { name: 'Eggs', category: 'Egg', unit: 'units', perCapitaQuantity: 1.0 }, // 1 egg
  { name: 'Vegetables', category: 'Vegetables', unit: 'kg', perCapitaQuantity: 0.080 }, // 80g
  { name: 'Chikki', category: 'Dessert', unit: 'units', perCapitaQuantity: 1.0 } // 1 unit
];

// Initial classroom students
export const INITIAL_STUDENTS: Student[] = [];

// Historical Wastage reports
export const INITIAL_WASTAGE_REPORTS: DailyWastageReport[] = [];

// Historical Feedback from students
export const INITIAL_FEEDBACK_LIST: StudentFeedback[] = [];

// Historical daily attendance metrics
export const HISTORICAL_ATTENDANCE: Array<{ date: string; attendancePercentage: number }> = [];
