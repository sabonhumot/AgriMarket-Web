---
name: AgriMarket
description: A restrained, airy landing page for direct local-produce connections in Cebu.
colors:
  ink: "#15372a"
  ink-muted: "#587167"
  leaf: "#1b6b43"
  leaf-dark: "#10452b"
  cream: "#f8faf9"
  mist: "#e7f0ea"
  sun: "#f2bc5b"
  coral: "#e97851"
typography:
  display:
    fontFamily: "ui-rounded, Avenir Next, Trebuchet MS, system-ui, sans-serif"
    fontSize: "clamp(3.45rem, 6vw, 6rem)"
    fontWeight: 760
    lineHeight: 0.91
    letterSpacing: "-.067em"
  body:
    fontFamily: "ui-rounded, Avenir Next, Trebuchet MS, system-ui, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.53
  label:
    fontFamily: "ui-rounded, Avenir Next, Trebuchet MS, system-ui, sans-serif"
    fontSize: ".74rem"
    fontWeight: 730
rounded:
  compact: "9px"
  card: "16px"
  button: "999px"
spacing:
  compact: "12px"
  standard: "22px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.leaf}"
    textColor: "#fff"
    rounded: "{rounded.button}"
    padding: "15px 22px"
  card:
    backgroundColor: "{colors.cream}"
    rounded: "{rounded.card}"
    padding: "28px"
---

# Design System: AgriMarket

## Overview

**Creative North Star: "The Neighborhood Harvest"**

AgriMarket is a calm, practical invitation to a nearby market: clean cream ground, generous open space, and botanical green structure. It feels local and approachable rather than rustic or overly decorative.

The design stays restrained and airy. Warm sun and coral appear as small signals of harvest, location, and movement; deep green carries confidence and action.

**Key Characteristics:**
- Open, editorial composition with direct messaging.
- Rounded, friendly interface details.
- Agricultural motifs used as quiet supporting texture.

## Colors

Green anchors trust and direct action; cream and mist leave the product feeling breathable, with sun and coral reserved for small, optimistic emphasis.

### Primary
- **Field Green:** the primary interactive and brand color.
- **Deep Canopy:** the high-contrast feature surface and button-hover color.

### Secondary
- **Harvest Sun:** a limited warm highlight for botanical forms and moments of optimism.
- **Market Coral:** a sparing accent for location and directional cues.

### Neutral
- **Paper Cream:** the default page surface.
- **Garden Mist:** soft grouping surface behind story content and fields.
- **Leaf Ink:** the principal readable text color.
- **Quiet Stem:** supporting body copy.

**The Breathing Room Rule.** Most of the viewport is cream, mist, or unfilled space; vivid accents should never become the dominant field.

## Typography

**Display Font:** ui-rounded / Avenir Next / Trebuchet MS / system UI, with Iowan Old Style, Baskerville, or Georgia for selective italic emphasis.

**Character:** Rounded sans-serif headlines make the experience clear and neighborly, while restrained serif italics add a human, harvest-note inflection.

### Hierarchy
- **Display:** bold, tightly tracked, near-single-line headlines for the hero and closing statement.
- **Headline:** bold, compact section titles that retain generous surrounding space.
- **Body:** muted, relaxed copy at roughly 1.5 line-height.
- **Label:** compact, confident uppercase labels for location and story navigation.

## Layout

The desktop composition uses a centered 1240px shell with generous 64px internal gutters. Hero content is a balanced two-column conversation between copy and a product scene; feature content alternates spacious heading bands with contained cards. At 850px, the site simplifies to one column with 25px gutters and preserves the product illustration as a focal object.

## Elevation & Depth

Depth is light and purposeful: white cards and the phone get soft green-tinted ambient shadows, while most structure is created with tonal fields, hairline dividers, and spacious separation.

**The Lift-With-Meaning Rule.** Elevation belongs to interactive controls, the phone, and floating product cues—not routine layout containers.

## Shapes

Pills identify actions and compact metadata. Product cards use softly rounded 16px corners; small fields and app surfaces use gentler 9–13px rounding. Organic leaf shapes and thin elliptical lines provide the recurring agricultural geometry.

## Components

### Buttons
- **Shape:** fully rounded pill.
- **Primary:** Field Green with white, compact bold text and generous horizontal padding.
- **Hover / Focus:** deepens to Deep Canopy and lifts slightly; focus uses a clear dark-green outline.

### Cards / Containers
- **Corner Style:** softly rounded card corners.
- **Background:** cream or white over mist; Deep Canopy for the active story panel.
- **Shadow Strategy:** only floating or product-forward elements receive ambient shadow.

### Navigation
- Compact bold links, with the download action kept visible. The small-screen navigation reduces to the essential CTA.

### Signature Component
The product-story panels turn a three-step service explanation into a direct, selectable sequence. The active panel is the primary visual state, not merely a selected border.

## Do's and Don'ts

### Do:
- **Do** keep large cream or mist fields around major messages.
- **Do** reserve sun and coral for small cues against the green-led palette.
- **Do** use organic agricultural motifs as low-density supporting forms.

### Don't:
- **Don't** fill every surface with cards, gradients, or decorative produce imagery.
- **Don't** use saturated accents as a full-page background.
- **Don't** replace the direct, warm copy voice with generic marketplace language.
