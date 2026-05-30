import { and, eq } from "drizzle-orm";

import { familyLink, studentProfile, users } from "@/db/schema";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/pdpa/audit";

export type ChildSummary = {
  studentUserId: string;
  name: string | null;
  studentNo: string;
  classLabel: string | null;
  relationship: "father" | "mother" | "guardian";
  primaryContact: boolean;
};

export type ChildDetail = {
  studentUserId: string;
  name: string | null;
  studentNo: string;
  classLabel: string | null;
  yearOfEntry: number | null;
  dob: string | null;
  relationship: "father" | "mother" | "guardian";
};

export async function listChildrenForParent(parentUserId: string): Promise<ChildSummary[]> {
  const rows = await db
    .select({
      studentUserId: familyLink.studentUserId,
      name: users.name,
      studentNo: studentProfile.studentNo,
      classLabel: studentProfile.classLabel,
      relationship: familyLink.relationship,
      primaryContact: familyLink.primaryContact,
    })
    .from(familyLink)
    .innerJoin(studentProfile, eq(studentProfile.userId, familyLink.studentUserId))
    .innerJoin(users, eq(users.id, familyLink.studentUserId))
    .where(eq(familyLink.parentUserId, parentUserId));

  return rows;
}

export async function viewChildForParent({
  parentUserId,
  studentUserId,
}: {
  parentUserId: string;
  studentUserId: string;
}): Promise<ChildDetail | null> {
  const [link] = await db
    .select({
      relationship: familyLink.relationship,
    })
    .from(familyLink)
    .where(
      and(eq(familyLink.parentUserId, parentUserId), eq(familyLink.studentUserId, studentUserId)),
    )
    .limit(1);

  if (!link) return null;

  const [row] = await db
    .select({
      name: users.name,
      studentNo: studentProfile.studentNo,
      classLabel: studentProfile.classLabel,
      yearOfEntry: studentProfile.yearOfEntry,
      dob: studentProfile.dob,
    })
    .from(studentProfile)
    .innerJoin(users, eq(users.id, studentProfile.userId))
    .where(eq(studentProfile.userId, studentUserId))
    .limit(1);

  if (!row) return null;

  await writeAudit({
    actorUserId: parentUserId,
    action: "student.view",
    resourceType: "student",
    resourceId: studentUserId,
  });

  return {
    studentUserId,
    name: row.name,
    studentNo: row.studentNo,
    classLabel: row.classLabel,
    yearOfEntry: row.yearOfEntry,
    dob: row.dob,
    relationship: link.relationship,
  };
}
