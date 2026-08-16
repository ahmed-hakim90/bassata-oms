import { describe, expect, it } from "vitest";
import {
  isShortcutBlocked,
  matchOperatorShortcut,
  OPERATOR_SHORTCUTS,
} from "@/lib/keyboard";

describe("operator shortcuts matching", () => {
  it("maps F1–F4 and F6–F7 to actions", () => {
    expect(matchOperatorShortcut({ key: "F1", code: "F1" })).toBe("save");
    expect(matchOperatorShortcut({ key: "F2", code: "F2" })).toBe("delete");
    expect(matchOperatorShortcut({ key: "F3", code: "F3" })).toBe("undo");
    expect(matchOperatorShortcut({ key: "F4", code: "F4" })).toBe("hold");
    expect(matchOperatorShortcut({ key: "F6", code: "F6" })).toBe("customer");
    expect(matchOperatorShortcut({ key: "F7", code: "F7" })).toBe("discount");
    expect(OPERATOR_SHORTCUTS.save).toBe("F1");
    expect(OPERATOR_SHORTCUTS.hold).toBe("F4");
  });

  it("accepts code when key is localized or missing", () => {
    expect(matchOperatorShortcut({ key: "Unknown", code: "F2" })).toBe("delete");
    expect(matchOperatorShortcut({ key: "Unknown", code: "F6" })).toBe("customer");
  });

  it("ignores unrelated keys including F5/F12", () => {
    expect(matchOperatorShortcut({ key: "a", code: "KeyA" })).toBeNull();
    expect(matchOperatorShortcut({ key: "F5", code: "F5" })).toBeNull();
    expect(matchOperatorShortcut({ key: "F12", code: "F12" })).toBeNull();
  });
});

describe("isShortcutBlocked", () => {
  it("blocks composing and save/delete/hold repeats", () => {
    expect(
      isShortcutBlocked(
        { repeat: false, isComposing: true, target: null },
        "save",
        { document: null }
      )
    ).toBe(true);
    expect(
      isShortcutBlocked(
        { repeat: true, isComposing: false, target: null },
        "save",
        { document: null }
      )
    ).toBe(true);
    expect(
      isShortcutBlocked(
        { repeat: true, isComposing: false, target: null },
        "delete",
        { document: null }
      )
    ).toBe(true);
    expect(
      isShortcutBlocked(
        { repeat: true, isComposing: false, target: null },
        "hold",
        { document: null }
      )
    ).toBe(true);
    expect(
      isShortcutBlocked(
        { repeat: true, isComposing: false, target: null },
        "undo",
        { document: null }
      )
    ).toBe(false);
    expect(
      isShortcutBlocked(
        { repeat: true, isComposing: false, target: null },
        "customer",
        { document: null }
      )
    ).toBe(false);
  });

  it("blocks while a dialog is open", () => {
    const openDoc = {
      querySelector: () => ({}),
    } as unknown as Document;
    expect(
      isShortcutBlocked(
        { repeat: false, isComposing: false, target: null },
        "save",
        { document: openDoc }
      )
    ).toBe(true);
  });

  it("allows shortcuts when no dialog is open", () => {
    const closedDoc = {
      querySelector: () => null,
    } as unknown as Document;
    expect(
      isShortcutBlocked(
        { repeat: false, isComposing: false, target: null },
        "undo",
        { document: closedDoc }
      )
    ).toBe(false);
  });
});
