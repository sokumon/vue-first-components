| scenario (js ms) | head2 | final |
|---|---:|---:|
| mount_1_desk:cold | 40.6 [21.5–43.1] | 38.0 [20.6–41.4] |
| mount_25_desk:cold | 109 [83.0–113] | 92.8 [77.6–98.1] |
| mount_100_desk:cold | 255 [240–288] | 221 [208–243] |
| mount_100_desk:warm | 159 [150–182] | 114 [102–122] |
| mount_300_desk:cold | 595 [572–611] | 493 [448–521] |
| mount_300_desk:warm | 426 [379–466] | 366 [353–391] |
| mount_100_opts20:cold | 267 [245–283] | 223 [193–234] |
| mount_300_opts20:warm | 422 [378–445] | 350 [321–369] |
| unmount_100_desk:warm | 11.1 [6.92–17.3] | 11.2 [6.48–14.1] |
| options20_arrive_closed | 2.86 [1.42–3.15] | 0.74 [0.66–1.08] |
| first_open_opts20 | 49.8 [37.8–53.0] | 44.7 [38.5–65.0] |
| first_close_opts20 | 5.22 [4.61–12.5] | 8.22 [5.70–9.77] |
| second_open_opts20 | 29.1 [19.7–30.7] | 26.6 [23.9–30.6] |
| open_other_opts20 | 19.4 [17.3–33.1] | 21.4 [19.4–34.7] |
| open_filterable_20 | 59.6 [48.3–80.7] | 56.9 [51.5–67.2] |
| open_filterable_500 | 315 [290–323] | 337 [321–379] |
| update100_query | 70.7 [59.0–76.7] | 35.4 [32.8–39.6] |
| update100_options20 | 53.4 [47.8–66.6] | 12.5 [7.00–16.7] |
| update100_query_again | 58.7 [51.4–65.2] | 42.5 [34.7–49.4] |
| update100_placeholder | 62.9 [51.2–74.2] | 40.0 [31.2–45.3] |
| update1_query | 1.09 [0.93–1.61] | 1.05 [0.60–1.41] |
| update1_options20 | 0.83 [0.64–1.36] | 0.38 [0.23–0.46] |
| type_20 per key (median of run medians) | 12.4 [10.4–12.7] | 11.0 [8.31–12.7] |
| type_500 per key (median of run medians) | 197 [181–199] | 208 [188–216] |

| per closed control | head2 | final |
|---|---:|---:|
| instances | 21 | 17 |
| effect | 41.0 | 34.0 |
| watch | 20.0 | 17.0 |
| computed | 59.0 | 57.0 |
| ref | 54.0 | 49.0 |
| objectRef | 37.0 | 35.0 |
| customRef | 4.00 | 4.00 |
| dep | 226 | 189 |
| instances open (20 opts) | 226 | 224 |
| DOM nodes in control (all/el/text/comment) | 29/7/18/4 | 25/7/12/6 |
| JS heap KB/control | 118 [118–118] | 98.8 [98.8–98.9] |
| Blink DOM nodes/control | 40.0 | 29.0 |
| JS listeners/control | 11.0 | 11.0 |
| re-renders per control: mount (dev, 10 controls) | 10 | 8 |
| re-renders per control: query (dev, 10 controls) | 21 | 8 |
| re-renders per control: placeholder (dev, 10 controls) | 21 | 8 |
| re-renders per control: options (dev, 10 controls) | 18 | 2 |
| re-renders per control: open (dev, 10 controls) | 6.4 | 4.3 |
| re-renders per control: close (dev, 10 controls) | 14 | 13.8 |

