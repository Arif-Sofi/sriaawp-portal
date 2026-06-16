import "dotenv/config";

import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  departments,
  familyLink,
  GLOBAL_SCOPE_SENTINEL,
  memo,
  news,
  parentProfile,
  parentVerificationRequest,
  permissions,
  rolePermission,
  roles,
  staffProfile,
  studentProfile,
  userRole,
  users,
} from "@/db/schema";

import { DEPARTMENTS, PERMISSIONS, ROLES, ROLE_PERMISSIONS } from "./catalogue";

const ADMIN_EMAIL = "test-admin@sriaawp.test";
const ADMIN_NAME = "Super Admin";

const TEACHER_COUNT = 5;
const PARENT_COUNT = 20;
const STUDENT_COUNT = 30;

faker.seed(20260506);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the seed script");
}

const icEncryptionKey = process.env.IC_ENCRYPTION_KEY ?? "dev-only-ic-key-do-not-use-in-prod";

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

async function seed() {
  await db.transaction(async (tx) => {
    const departmentIds = await upsertDepartments(tx);
    const roleIds = await upsertRoles(tx);
    const permissionIds = await upsertPermissions(tx);
    await upsertRolePermissions(tx, roleIds, permissionIds);

    const adminUserId = await upsertAdmin(tx);
    await assignRole(tx, adminUserId, roleIds.admin, "global", GLOBAL_SCOPE_SENTINEL);

    const teacherUserIds = await upsertTeachers(tx, Object.values(departmentIds));
    for (const { userId, deptId } of teacherUserIds) {
      await assignRole(tx, userId, roleIds.teacher, "department", deptId);
    }

    const parentUserIds = await upsertParents(tx);
    for (const userId of parentUserIds) {
      await assignRole(tx, userId, roleIds.parent, "global", GLOBAL_SCOPE_SENTINEL);
    }

    const studentUserIds = await upsertStudents(tx);
    for (const userId of studentUserIds) {
      await assignRole(tx, userId, roleIds.student, "global", GLOBAL_SCOPE_SENTINEL);
    }

    await upsertFamilyLinks(tx, parentUserIds, studentUserIds);
    await approveParents(tx, parentUserIds, adminUserId);

    const teacherUserId = teacherUserIds[0]?.userId ?? adminUserId;
    await upsertNews(tx, adminUserId, teacherUserId);
    await upsertMemos(tx, adminUserId, teacherUserId);
  });

  await client.end();
  console.log("seed: complete");
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function upsertDepartments(tx: Tx): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const dept of DEPARTMENTS) {
    const [row] = await tx
      .insert(departments)
      .values({ code: dept.code, name: dept.name })
      .onConflictDoUpdate({
        target: departments.code,
        set: { name: dept.name, updatedAt: new Date() },
      })
      .returning({ id: departments.id });
    ids[dept.code] = row.id;
  }
  return ids;
}

async function upsertRoles(tx: Tx): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const role of ROLES) {
    const [row] = await tx
      .insert(roles)
      .values({ code: role.code, label: role.label })
      .onConflictDoUpdate({ target: roles.code, set: { label: role.label } })
      .returning({ id: roles.id });
    ids[role.code] = row.id;
  }
  return ids;
}

async function upsertPermissions(tx: Tx): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const perm of PERMISSIONS) {
    const [row] = await tx
      .insert(permissions)
      .values({ code: perm.code, label: perm.label })
      .onConflictDoUpdate({ target: permissions.code, set: { label: perm.label } })
      .returning({ id: permissions.id });
    ids[perm.code] = row.id;
  }
  return ids;
}

async function upsertRolePermissions(
  tx: Tx,
  roleIds: Record<string, string>,
  permissionIds: Record<string, string>,
): Promise<void> {
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleIds[roleCode];
    if (!roleId) continue;
    for (const permCode of permCodes) {
      const permId = permissionIds[permCode];
      if (!permId) continue;
      await tx
        .insert(rolePermission)
        .values({ roleId, permissionId: permId })
        .onConflictDoNothing();
    }
  }
}

async function upsertAdmin(tx: Tx): Promise<string> {
  const [row] = await tx
    .insert(users)
    .values({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      emailVerified: new Date(),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: ADMIN_NAME, updatedAt: new Date() },
    })
    .returning({ id: users.id });
  return row.id;
}

async function assignRole(
  tx: Tx,
  userId: string,
  roleId: string,
  scopeTypeValue: "global" | "department",
  scopeId: string,
): Promise<void> {
  await tx
    .insert(userRole)
    .values({ userId, roleId, scopeType: scopeTypeValue, scopeId })
    .onConflictDoNothing();
}

async function upsertTeachers(
  tx: Tx,
  departmentIds: string[],
): Promise<Array<{ userId: string; deptId: string }>> {
  const result: Array<{ userId: string; deptId: string }> = [];
  for (let teacherIndex = 0; teacherIndex < TEACHER_COUNT; teacherIndex += 1) {
    const employeeNo = `EMP-${String(teacherIndex + 1).padStart(4, "0")}`;
    const email = `teacher.${teacherIndex + 1}@sriaawp.test`;
    const name = faker.person.fullName();
    const deptId = departmentIds[teacherIndex % departmentIds.length];

    const [userRow] = await tx
      .insert(users)
      .values({ name, email, emailVerified: new Date() })
      .onConflictDoUpdate({
        target: users.email,
        set: { name, updatedAt: new Date() },
      })
      .returning({ id: users.id });

    await tx
      .insert(staffProfile)
      .values({
        userId: userRow.id,
        employeeNo,
        deptId,
        position: faker.person.jobTitle(),
        joinedAt: faker.date.past({ years: 5 }).toISOString().slice(0, 10),
      })
      .onConflictDoUpdate({
        target: staffProfile.userId,
        set: { deptId, updatedAt: new Date() },
      });

    result.push({ userId: userRow.id, deptId });
  }
  return result;
}

async function upsertParents(tx: Tx): Promise<string[]> {
  const ids: string[] = [];
  for (let parentIndex = 0; parentIndex < PARENT_COUNT; parentIndex += 1) {
    const email = `parent.${parentIndex + 1}@sriaawp.test`;
    const name = faker.person.fullName();

    const [userRow] = await tx
      .insert(users)
      .values({ name, email, emailVerified: new Date() })
      .onConflictDoUpdate({
        target: users.email,
        set: { name, updatedAt: new Date() },
      })
      .returning({ id: users.id });

    await tx
      .insert(parentProfile)
      .values({
        userId: userRow.id,
        phone: faker.phone.number(),
        address: faker.location.streetAddress({ useFullAddress: true }),
      })
      .onConflictDoUpdate({
        target: parentProfile.userId,
        set: {
          phone: faker.phone.number(),
          updatedAt: new Date(),
        },
      });

    ids.push(userRow.id);
  }
  return ids;
}

async function upsertStudents(tx: Tx): Promise<string[]> {
  const ids: string[] = [];
  for (let studentIndex = 0; studentIndex < STUDENT_COUNT; studentIndex += 1) {
    const studentNo = `STU-${String(studentIndex + 1).padStart(5, "0")}`;
    const email = `student.${studentIndex + 1}@sriaawp.test`;
    const name = faker.person.fullName();
    const dob = faker.date.between({ from: "2014-01-01", to: "2018-12-31" });
    const syntheticIc = `${dob.toISOString().slice(2, 10).replace(/-/g, "")}-14-${faker.string.numeric(4)}`;

    const [userRow] = await tx
      .insert(users)
      .values({ name, email, emailVerified: new Date() })
      .onConflictDoUpdate({
        target: users.email,
        set: { name, updatedAt: new Date() },
      })
      .returning({ id: users.id });

    const encryptedIc = await tx.execute<{ encrypted: Uint8Array }>(
      sql`select pgp_sym_encrypt(${syntheticIc}, ${icEncryptionKey}) as encrypted`,
    );
    const icBytes = (encryptedIc as unknown as { encrypted: Uint8Array }[])[0]?.encrypted;

    await tx
      .insert(studentProfile)
      .values({
        userId: userRow.id,
        studentNo,
        classLabel: `Year ${faker.number.int({ min: 1, max: 6 })}-${faker.helpers.arrayElement(["A", "B", "C"])}`,
        yearOfEntry: faker.number.int({ min: 2022, max: 2026 }),
        dob: dob.toISOString().slice(0, 10),
        icNoEncrypted: icBytes,
      })
      .onConflictDoUpdate({
        target: studentProfile.userId,
        set: {
          classLabel: `Year ${faker.number.int({ min: 1, max: 6 })}-${faker.helpers.arrayElement(["A", "B", "C"])}`,
          updatedAt: new Date(),
        },
      });

    ids.push(userRow.id);
  }
  return ids;
}

async function upsertFamilyLinks(tx: Tx, parentIds: string[], studentIds: string[]): Promise<void> {
  let cursor = 0;
  for (const parentId of parentIds) {
    const childCount = faker.number.int({ min: 1, max: 2 });
    for (let childIndex = 0; childIndex < childCount; childIndex += 1) {
      if (cursor >= studentIds.length) return;
      const studentId = studentIds[cursor];
      cursor += 1;
      await tx
        .insert(familyLink)
        .values({
          parentUserId: parentId,
          studentUserId: studentId,
          relationship: faker.helpers.arrayElement(["father", "mother", "guardian"]),
          primaryContact: childIndex === 0,
        })
        .onConflictDoNothing();
    }
  }
}

async function approveParents(tx: Tx, parentIds: string[], reviewerUserId: string): Promise<void> {
  for (const parentId of parentIds) {
    await tx
      .insert(parentVerificationRequest)
      .values({
        userId: parentId,
        studentIcProvided: faker.string.numeric(12),
        status: "approved",
        reviewerUserId,
        reviewedAt: new Date(),
        notes: "Auto-approved by seed script",
      })
      .onConflictDoNothing();
  }
}

const SEED_NEWS = [
  {
    slug: "selamat-datang-ke-portal-sriaawp",
    title: "Selamat Datang ke Portal SRIAAWP",
    excerpt: "Portal baharu SRIAAWP kini tersedia untuk ibu bapa, guru, dan pelajar.",
    body: "Portal rasmi SRIAAWP telah dilancarkan. Ibu bapa dan penjaga boleh mengakses maklumat pelajar, takwim sekolah, dan menghantar pertanyaan melalui portal ini.",
    visibility: "public" as const,
    publishedAt: new Date("2026-01-10T08:00:00Z"),
  },
  {
    slug: "jadual-peperiksaan-pertengahan-tahun-2026",
    title: "Jadual Peperiksaan Pertengahan Tahun 2026",
    excerpt: "Jadual peperiksaan pertengahan tahun bagi semua tahun telah ditetapkan.",
    body: "Peperiksaan pertengahan tahun 2026 akan diadakan dari 15 Mei hingga 22 Mei 2026. Sila semak jadual terperinci di papan kenyataan sekolah.",
    visibility: "public" as const,
    publishedAt: new Date("2026-02-01T08:00:00Z"),
  },
  {
    slug: "aktiviti-hari-sukan-tahunan-2026",
    title: "Aktiviti Hari Sukan Tahunan 2026",
    excerpt: "Hari Sukan Tahunan SRIAAWP dijadualkan pada bulan Mac 2026.",
    body: "Hari Sukan Tahunan SRIAAWP 2026 akan berlangsung pada 14 Mac 2026 di padang sekolah. Ibu bapa dijemput hadir untuk memberi sokongan kepada anak-anak mereka.",
    visibility: "public" as const,
    publishedAt: new Date("2026-02-15T08:00:00Z"),
  },
  {
    slug: "mesyuarat-pibg-suku-tahun-pertama",
    title: "Mesyuarat PIBG Suku Tahun Pertama",
    excerpt: "Mesyuarat PIBG bagi suku tahun pertama 2026 dijadualkan pada 20 Februari.",
    body: "Semua kakitangan sekolah dijemput menghadiri Mesyuarat PIBG yang akan diadakan pada 20 Februari 2026, jam 2.30 petang di Dewan Utama. Kehadiran adalah wajib bagi semua guru.",
    visibility: "internal" as const,
    publishedAt: new Date("2026-02-05T08:00:00Z"),
  },
  {
    slug: "panduan-ibu-bapa-portal-2026",
    title: "Panduan Penggunaan Portal untuk Ibu Bapa",
    excerpt: "Panduan lengkap cara menggunakan portal SRIAAWP untuk ibu bapa.",
    body: "Dokumen panduan penggunaan portal SRIAAWP untuk ibu bapa dan penjaga telah dikemaskini. Sila hubungi pejabat sekolah jika memerlukan bantuan lanjut.",
    visibility: "role_list" as const,
    visibilityRoles: ["parent"],
    publishedAt: new Date("2026-01-20T08:00:00Z"),
  },
  {
    slug: "draf-rancangan-strategik-2026-2028",
    title: "Draf Rancangan Strategik SRIAAWP 2026-2028",
    excerpt: "Draf rancangan strategik sekolah sedang dalam semakan.",
    body: "Draf rancangan strategik SRIAAWP untuk tempoh 2026-2028 sedang disediakan. Maklum balas daripada kakitangan akan diterima sehingga 31 Mac 2026.",
    visibility: "internal" as const,
    publishedAt: null,
  },
];

const SEED_MEMOS = [
  {
    title: "Peringatan: Penyerahan Laporan Prestasi Pelajar",
    body: "Semua guru diminta menyerahkan laporan prestasi pelajar bagi suku tahun pertama sebelum 28 Februari 2026. Sila hantar kepada Penolong Kanan Akademik.",
    visibility: "internal" as const,
    pinned: true,
    publishedAt: new Date("2026-02-10T08:00:00Z"),
  },
  {
    title: "Taklimat Keselamatan Data PDPA",
    body: "Taklimat mengenai keperluan Akta Perlindungan Data Peribadi 2010 akan diadakan pada 5 Mac 2026. Kehadiran semua kakitangan adalah wajib.",
    visibility: "internal" as const,
    pinned: false,
    publishedAt: new Date("2026-02-20T08:00:00Z"),
  },
  {
    title: "Borang Kebenaran Aktiviti Ko-Kurikulum",
    body: "Ibu bapa dan penjaga diminta mengembalikan borang kebenaran aktiviti ko-kurikulum sebelum 1 Mac 2026. Borang boleh dimuat turun daripada portal.",
    visibility: "role_list" as const,
    visibilityRoles: ["teacher"],
    pinned: false,
    publishedAt: new Date("2026-02-12T08:00:00Z"),
  },
];

async function upsertNews(tx: Tx, adminUserId: string, teacherUserId: string): Promise<void> {
  for (const item of SEED_NEWS) {
    await tx
      .insert(news)
      .values({
        ...item,
        authorUserId: item.visibility === "internal" ? teacherUserId : adminUserId,
      })
      .onConflictDoNothing();
  }
}

async function upsertMemos(tx: Tx, adminUserId: string, teacherUserId: string): Promise<void> {
  for (const item of SEED_MEMOS) {
    await tx
      .insert(memo)
      .values({
        ...item,
        authorUserId: item.visibility === "role_list" ? teacherUserId : adminUserId,
      })
      .onConflictDoNothing();
  }
}

seed().catch((error) => {
  console.error("seed failed:", error);
  client.end().finally(() => {
    process.exit(1);
  });
});
