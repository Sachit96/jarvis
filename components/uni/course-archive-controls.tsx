"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { archiveCourseAction, deleteCourseAction } from "@/actions/uni-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Archive, restore and delete for one course.
 *
 * Both server actions have existed since the module was built and neither
 * had a control anywhere in the UI, so a finished term stayed in the course
 * list forever and a course created by mistake could never be removed.
 *
 * Archive is the ordinary end-of-term move and is reversible, so it acts
 * immediately. Delete takes the assessments, grades, schedule blocks and
 * materials with it, so it asks first.
 */
export function CourseArchiveControls({
  courseId,
  courseName,
  archived,
}: {
  courseId: string;
  courseName: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={archived ? "Restore course" : "Archive course"}
        title={archived ? "Restore course" : "Archive course"}
        disabled={isPending}
        onClick={() => startTransition(() => archiveCourseAction(courseId, !archived))}
      >
        {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete course"
              title="Delete course"
              className="text-foreground-tertiary hover:text-danger"
            >
              <Trash2 className="size-4" />
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {courseName}?</DialogTitle>
          </DialogHeader>
          <p className="text-body text-foreground-secondary">
            This removes the course along with its assessments, recorded grades, class times and
            materials. Archiving keeps all of it and just takes the course off the list.
          </p>
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost">Cancel</Button>} />
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await deleteCourseAction(courseId);
                  router.push("/uni/courses");
                })
              }
            >
              {isPending ? "Deleting…" : "Delete course"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
