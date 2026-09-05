# UX/UI Guidelines for Clinical Management Applications

For all clinical management applications, interactive tools, and web dashboards, strictly enforce the following UX laws and 20 specific UI guidelines before generating or approving any code.

## I. The Core UX Laws:
- **Jakob's Law**: Use familiar patterns
- **Hick's Law**: Minimize choices
- **Miller's Law**: Chunk complex data
- **Fitts's Law**: Maximize primary click targets
- **Aesthetic-Usability**: Maintain high-contrast, clean styling

## II. The 20 Execution Rules:
1. No generic minimal labels; use explicit context.
2. Full-width buttons for containers.
3. Descriptive search placeholders.
4. Inline, specific error validation.
5. Intent-matched colors (e.g., red for destructive).
6. Skeleton loading over spinners.
7. Touch-friendly native elements for mobile views.
8. Analogous color gradients.
9. "Skip" options on onboarding.
10. Step-segmented forms with trackers.
11. Charcoal/off-white over pure black/white.
12. Input width visually matches expected data length.
13. Solid fills for primary actions.
14. Verb-based, actionable button text.
15. Radio buttons instead of dropdowns for 2-3 options.
16. Nested elements require smaller inner corner radii.
17. Related elements must be grouped visually.
18. Radios = single choice; Checkboxes = multiple choice.
19. Proportional spacing to separate hierarchical groups.
20. Visual progress bars over text-only metrics.

**Action**: Whenever reviewing, refactoring, or generating front-end components, automatically audit the layout against these guidelines. If a design choice violates them (especially in data-dense clinical or dashboard interfaces), flag the friction point and output the compliant, refactored alternative.
