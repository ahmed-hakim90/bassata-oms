"use client";

import { useEffect } from "react";
import { translateText, type AppLanguage } from "@/lib/i18n/translations";
import { useUiStore } from "@/stores/ui-store";

const originalText = new WeakMap<Text, string>();
const translatedTextNodes = new WeakSet<Text>();
const translatableAttributes = ["placeholder", "title", "aria-label"] as const;

function shouldSkip(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(
    parent.closest(
      "script, style, code, pre, input, textarea, select, [data-no-translate]"
    )
  );
}

function translateTextNode(node: Text, language: AppLanguage) {
  if (shouldSkip(node)) return;
  const original = originalText.get(node) ?? node.nodeValue ?? "";
  if (!originalText.has(node)) originalText.set(node, original);
  translatedTextNodes.add(node);
  node.nodeValue = translateText(original, language);
}

function translateAttributes(element: Element, language: AppLanguage) {
  for (const attr of translatableAttributes) {
    const value = element.getAttribute(attr);
    if (!value) continue;
    const originalAttr = `data-original-${attr}`;
    const original = element.getAttribute(originalAttr) ?? value;
    if (!element.hasAttribute(originalAttr)) {
      element.setAttribute(originalAttr, original);
    }
    element.setAttribute(attr, translateText(original, language));
  }
}

function translateTree(root: ParentNode, language: AppLanguage) {
  if (root instanceof Element) translateAttributes(root, language);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current as Text, language);
    } else if (current instanceof Element) {
      translateAttributes(current, language);
    }
    current = walker.nextNode();
  }
}

export function LanguageSync() {
  const language = useUiStore((s) => s.language);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle("font-arabic", language === "ar");

    translateTree(document.body, language);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node as Text, language);
          } else if (node instanceof Element) {
            translateTree(node, language);
          }
        });
        if (
          mutation.type === "characterData" &&
          mutation.target.nodeType === Node.TEXT_NODE
        ) {
          if (translatedTextNodes.has(mutation.target as Text)) {
            translatedTextNodes.delete(mutation.target as Text);
            continue;
          }
          originalText.delete(mutation.target as Text);
          translateTextNode(mutation.target as Text, language);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [language]);

  return null;
}
