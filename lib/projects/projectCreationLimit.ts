import type { ProjectPlan } from '@prisma/client';

export const FREE_PROJECT_CREATIONS_PER_MONTH = 1;

export class ProjectCreationLimitError extends Error {
  readonly code = 'FREE_PROJECT_MONTHLY_LIMIT';

  constructor() {
    super(
      'Free plan allows one new project per month. Upgrade your plan to create another project now.',
    );
    this.name = 'ProjectCreationLimitError';
  }
}

/** Calendar-month boundaries are kept in UTC so every server uses the same window. */
export function projectCreationMonthRange(now = new Date()) {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

export function assertProjectCreationAllowed(plan: ProjectPlan, projectsCreatedThisMonth: number) {
  if (plan === 'FREE' && projectsCreatedThisMonth >= FREE_PROJECT_CREATIONS_PER_MONTH) {
    throw new ProjectCreationLimitError();
  }
}
