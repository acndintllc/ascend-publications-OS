---
title: VERA Role Engine Test
slug: vera-role-test
mode: web-reader
authors: [ASCEND QA, VERA]
subtitle: Phase 2 visual + role-gating fixture
eyebrow: Test Fixture
---

:::chapter-opener eyebrow="Chapter 1"
# The Interpretation Test
:::

This is normal manuscript text that appears before the first VERA block. It
should render exactly the same in every role — none, narrator, character,
and interpretation.

The next paragraph carries a VERA interpretation note with a short title and
a source citation. In interpretation mode it must render as the editorial
component; in every other role it must disappear entirely while leaving this
paragraph intact.

This paragraph carries a second VERA note — no title, no source — to verify
the component renders cleanly when only the body is present.

This is normal manuscript text that appears after both VERA blocks. It must
remain visible in every role and must never be visually fused with the VERA
component above.
