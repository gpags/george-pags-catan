# CatCustoms — images to save

**Images pasted into a chat message are not files on your computer.** I can look at
them, but I can't write them to disk — you have to save each one yourself. That's why
the renders you sent still aren't on the site.

Save them into this folder using **exactly** these filenames. The pages already point
at them: the moment a file with the right name exists, the page swaps the illustration
for your photo automatically. No code change, no redeploy of anything else.

`Images/` has a **capital I** in git. A lowercase `images/` path 404s on Vercel.

---

## Already here ✅

| File | What it is | Used on |
|---|---|---|
| `cc-parts-exploded.jpg` | Cottage frame with cat figures + blank nameplate beside it | Landing hero, 1-of-1 |
| `cc-parts-cats.jpg` | The two painted figures and the nameplate alone | Landing, "personalised parts" |
| `cc-meadow-render.jpg` | Sage Sleepy Meadow design | Templates grid |

---

## Cottage colourways — 4 files (product page)

These are the four you sent most recently. All the same Cottage, different colours.

| Save as | Which image |
|---|---|
| `cc-cottage-cream.jpg` | Cream walls, brown timbers |
| `cc-cottage-butter.jpg` | Yellow walls, charcoal timbers |
| `cc-cottage-blossom.jpg` | Pink walls, mint-green timbers |
| `cc-cottage-lilac.jpg` | Lavender walls, pale blue timbers |

Until these exist the product page shows a drawn stand-in. **The nameplate on it always
reads "Luna & Ruska" and does not change when a customer types a name** — that's
deliberate, per your note. The typed name shows underneath the field instead.

---

## Other templates — 3 files (landing page)

| Save as | Which image |
|---|---|
| `cc-tpl-bamboo.jpg` | Green bamboo columns |
| `cc-tpl-castle.jpg` | Lavender/grey turrets, "CASTLE KITTIES" |
| `cc-tpl-bloom.jpg` | Sage + pink trellis, "BLOOM KITTY" |

These three are marked **Coming soon** on the landing page and their Choose button is
disabled, because only the Cottage has a working product page. Once you want them
buyable, say so and I'll build their product pages.

---

## The Journey — 5 you have, 4 to shoot

| Save as | Which image | Status |
|---|---|---|
| `cc-journey-1-reference.jpg` | Your two tabbies asleep on the striped towel | ✅ you have it |
| `cc-journey-2-concepts.jpg` | The grid of many design thumbnails | ✅ you have it |
| `cc-journey-3-approval.jpg` | Two side-by-side "Luna & Ruska" finals | ✅ you have it |
| `cc-journey-4-model.jpg` | Grey 3D model on dark background | ✅ you have it |
| `cc-journey-5-print-ready.jpg` | Blender screenshot, wireframe visible | ✅ you have it |
| `cc-journey-6-print.jpg` | Parts on the print bed | 📷 to shoot |
| `cc-journey-7-paint.jpg` | Brush in hand, figure mid-paint | 📷 to shoot |
| `cc-journey-8-ship.jpg` | Packed box, ready to go | 📷 to shoot |
| `cc-journey-9-unbox.jpg` | Unboxing / the piece in a real home | 📷 to shoot |

---

## Notes

**Journey step 1** is the strongest image in the set. A phone snap of two cats asleep on
a beach towel, sitting directly under "any decent picture", proves the promise better
than a styled photo could. Don't replace it with something nicer.

**The concept grid (step 2)** shows the *volume* of options you generate. Don't crop it
to three; the density is the point.

**Steps 6–9 are what sell the $279 tier** and they're the four you don't have. Shoot them
on the next 1-of-1 you build, in order, on a phone. They don't need to be good — they
need to be real.

**The reviews block under the journey is intentionally empty** and carries a visible
warning. Delete the warning only when you have actual customer photos.

**While a file is missing, its `Images/…` request 404s in the browser console.** That's
the fallback doing its job, not a bug — the page catches the error and draws the
stand-in. The 404s disappear as the files land.
