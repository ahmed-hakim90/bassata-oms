import {
  LABEL_PRINT_STORAGE_KEY,
  isLabelPrintJob,
  type LabelPrintJob,
} from "@/modules/reports/labels/print-job";
import { savePrintJob, loadPrintJob } from "@/lib/print/print-job-storage";

/** Persist label print job for a new tab (sessionStorage is NOT shared across windows). */
export function saveLabelPrintJob(job: LabelPrintJob): void {
  savePrintJob(LABEL_PRINT_STORAGE_KEY, job);
}

/** Load and validate label print job from storage. */
export function loadLabelPrintJob(): LabelPrintJob | null {
  return loadPrintJob(LABEL_PRINT_STORAGE_KEY, isLabelPrintJob);
}
