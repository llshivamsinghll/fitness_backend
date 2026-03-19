-- CreateTable
CREATE TABLE "PlanDailyProgress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "planDay" INTEGER NOT NULL,
    "completedExercises" JSONB,
    "completedMeals" JSONB,
    "currentSet" JSONB,
    "workoutTimer" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanDailyProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanDailyProgress_userId_planId_idx" ON "PlanDailyProgress"("userId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDailyProgress_userId_planId_planDay_key" ON "PlanDailyProgress"("userId", "planId", "planDay");

-- AddForeignKey
ALTER TABLE "PlanDailyProgress" ADD CONSTRAINT "PlanDailyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDailyProgress" ADD CONSTRAINT "PlanDailyProgress_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
