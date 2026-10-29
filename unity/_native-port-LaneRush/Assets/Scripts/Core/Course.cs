// The course generator, ported 1:1 from the web game's src/logic.js (buildCourse).
// Same seed -> exactly the same course as the browser version (same random stream,
// same patterns, same fairness rule), so both games can share seeds later.
// Plain C#: no Unity types, so it can be tested outside the editor.
using System;
using System.Collections.Generic;

namespace LaneRush
{
    public enum Obstacle { None, Hurdle, Gate, Crate, Roller }

    public sealed class Row
    {
        public double Z;
        public Obstacle[] Lanes = new Obstacle[4];
        public int[] Looks = new int[4];
        public Obstacle Intro = Obstacle.None; // first time this kind shows up
    }

    public struct LanePoint { public double Z; public int Lane; }

    public sealed class Bus
    {
        public int Lane;
        public double Z0, Z1;
        public int Look;
        public bool Ramp;
    }

    public sealed class CourseData
    {
        public readonly List<Row> Rows = new List<Row>();
        public readonly List<LanePoint> Boosts = new List<LanePoint>();
        public readonly List<LanePoint> Slows = new List<LanePoint>();
        public readonly List<LanePoint> Boxes = new List<LanePoint>();
        public readonly List<LanePoint> Hearts = new List<LanePoint>();
        public readonly List<Bus> Buses = new List<Bus>();
        public double Len;

        /// <summary>The floor under you in `lane` at distance `d`: the road (0), a ramp, or a bus roof.</summary>
        public double FloorAt(int lane, double d)
        {
            foreach (var b in Buses)
            {
                if (b.Lane != lane) continue;
                if (d >= b.Z0 && d <= b.Z1) return Rules.BusH;
                if (b.Ramp && d >= b.Z0 - Rules.RampLen && d < b.Z0) return Rules.BusH * (d - (b.Z0 - Rules.RampLen)) / Rules.RampLen;
            }
            return 0;
        }

        /// <summary>Is a bus's side (not its ramp) in `lane` at `d`?</summary>
        public bool BusAt(int lane, double d)
        {
            foreach (var b in Buses) if (b.Lane == lane && d >= b.Z0 - 0.5 && d <= b.Z1 + 0.5) return true;
            return false;
        }
    }

    /// <summary>Game constants shared with the web version (src/logic.js).</summary>
    public static class Rules
    {
        public const double TrackLen = 700;
        public const double SurvivalLen = 9000;
        public const int Lanes = 4;
        public const double LaneW = 2.0;
        public const double BaseSpeed = 12;
        public const double SurvivalMaxSpeed = 24;
        public const double SurvivalBoost = 5;
        public const double SurvivalRocket = 10;
        public const double SprintMaxSpeed = 16;
        public const double BusH = 2.3;
        public const double BusLen = 11;
        public const double RampLen = 6;
        public const double MaxEmptyM = 42;
        public const double HeartEveryM = 420;
        public const int Lives = 3;

        public static double SurvivalSpeed(double s)
        {
            double t = Math.Max(0, s);
            return Math.Min(SurvivalMaxSpeed, BaseSpeed + 0.1 * Math.Min(t, 70) + 0.04 * Math.Max(0, t - 70));
        }

        /// <summary>Expected running speed (m/s) at distance d (v² = v0² + 2ad, capped).</summary>
        public static double SpeedAtDistance(bool endless, double d)
        {
            double x = Math.Max(0, d);
            if (!endless) return Math.Min(SprintMaxSpeed, Math.Sqrt(BaseSpeed * BaseSpeed + 0.12 * x));
            const double D1 = 12 * 70 + 0.05 * 70 * 70;
            if (x <= D1) return Math.Sqrt(BaseSpeed * BaseSpeed + 0.2 * x);
            return Math.Min(SurvivalMaxSpeed, Math.Sqrt(19 * 19 + 0.08 * (x - D1)));
        }
    }

    /// <summary>mulberry32, bit-for-bit the same as the JS rng().</summary>
    public sealed class Mulberry32
    {
        uint a;
        public Mulberry32(uint seed) { a = seed; }
        public double Next()
        {
            unchecked
            {
                a += 0x6d2b79f5u;
                uint t = a;
                t = (t ^ (t >> 15)) * (t | 1u);
                t ^= t + (t ^ (t >> 7)) * (t | 61u);
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }
    }

    public static class CourseBuilder
    {
        enum Act { Run, Jump, Slide }

        sealed class Stage
        {
            public string Name; public double From; public double React;
            public List<KeyValuePair<string, double>> Mix;
            public double Breather => Mix.Find(kv => kv.Key == "breather").Value;
        }

        static List<KeyValuePair<string, double>> M(params object[] kv)
        {
            var l = new List<KeyValuePair<string, double>>();
            for (int i = 0; i < kv.Length; i += 2) l.Add(new KeyValuePair<string, double>((string)kv[i], Convert.ToDouble(kv[i + 1])));
            return l;
        }

        static readonly Stage[] Stages =
        {
            new Stage { Name = "Warm-up", From = 0, React = 1.3, Mix = M("hurdleOne", 4, "hurdleWall", 2, "crateOne", 2, "bus", 12) },
            new Stage { Name = "Getting going", From = 250, React = 1.15, Mix = M("hurdleOne", 1, "crateOne", 1, "hurdleWall", 1, "split", 2.5, "barrels", 1.2, "bus", 16, "breather", 0.7) },
            new Stage { Name = "In the zone", From = 700, React = 1.02, Mix = M("split", 2, "barrels", 1, "tunnel", 1.2, "slalom2", 1.5, "hurdleWall", 1, "bus", 16, "breather", 0.55) },
            new Stage { Name = "Pro", From = 1400, React = 1.05, Mix = M("split", 1.2, "tunnel", 1, "slalom2", 1, "slalom3", 1.3, "combo", 1.2, "barrels2", 1, "bus", 15, "breather", 0.45) },
            new Stage { Name = "Master", From = 2400, React = 0.92, Mix = M("tunnel", 1, "slalom3", 1.5, "combo", 1.3, "zigzag", 1.2, "barrels2", 1, "split", 1, "bus", 15, "breather", 0.35) },
        };

        // in the warm-up, each first-time pattern waits until here (insertion order matters)
        static readonly List<KeyValuePair<string, double>> FirstAt = M("hurdleOne", 0, "bus", 40, "hurdleWall", 125, "crateOne", 150);
        static double? FirstAtOf(string n) { foreach (var kv in FirstAt) if (kv.Key == n) return kv.Value; return null; }

        static readonly Dictionary<Obstacle, int> LooksOf = new Dictionary<Obstacle, int> { { Obstacle.Hurdle, 2 }, { Obstacle.Gate, 2 }, { Obstacle.Crate, 3 }, { Obstacle.Roller, 1 } };

        static Stage StageAt(double z) { var st = Stages[0]; foreach (var x in Stages) if (z >= x.From) st = x; return st; }

        // ── fairness ──
        const double ReactS = 0.3, LaneS = 0.12;
        static double Recover(Act a) => a == Act.Jump ? 0.33 : a == Act.Slide ? 0.38 : 0;
        static double Lead(Act a) => a == Act.Jump ? 0.25 : a == Act.Slide ? 0.12 : 0;
        static Act? ActFor(Obstacle k) => k == Obstacle.None ? Act.Run : k == Obstacle.Hurdle ? Act.Jump : k == Obstacle.Gate ? Act.Slide : (Act?)null;
        static double NeedSeconds(int fromLane, Act fromAct, int toLane, Act toAct) => ReactS + Math.Abs(fromLane - toLane) * LaneS + Recover(fromAct) + Lead(toAct);

        // reach: an ordered map lane -> act (JS Map keeps insertion order)
        static double WorstNeed(List<KeyValuePair<int, Act>> reach, Row row)
        {
            double worst = 0;
            foreach (var r in reach)
            {
                double best = double.PositiveInfinity;
                for (int b = 0; b < 4; b++)
                {
                    var actB = ActFor(row.Lanes[b]);
                    if (actB.HasValue) best = Math.Min(best, NeedSeconds(r.Key, r.Value, b, actB.Value));
                }
                worst = Math.Max(worst, best);
            }
            return worst;
        }

        static List<KeyValuePair<int, Act>> NextReach(List<KeyValuePair<int, Act>> reach, Row row, double dt)
        {
            var outL = new List<KeyValuePair<int, Act>>();
            for (int b = 0; b < 4; b++)
            {
                var actB = ActFor(row.Lanes[b]);
                if (!actB.HasValue) continue;
                foreach (var r in reach)
                    if (NeedSeconds(r.Key, r.Value, b, actB.Value) <= dt + 1e-6) { SetMap(outL, b, actB.Value); }
            }
            return outL;
        }

        static void SetMap(List<KeyValuePair<int, Act>> m, int k, Act v)
        {
            for (int i = 0; i < m.Count; i++) if (m[i].Key == k) { m[i] = new KeyValuePair<int, Act>(k, v); return; }
            m.Add(new KeyValuePair<int, Act>(k, v));
        }

        static List<KeyValuePair<int, Act>> AllRun() => new List<KeyValuePair<int, Act>> { new KeyValuePair<int, Act>(0, Act.Run), new KeyValuePair<int, Act>(1, Act.Run), new KeyValuePair<int, Act>(2, Act.Run), new KeyValuePair<int, Act>(3, Act.Run) };

        // ── patterns ──
        static int Floor4(Mulberry32 r) => (int)Math.Floor(r.Next() * 4);
        static Obstacle[] PlaceOne(Mulberry32 r, Obstacle k) { var l = new Obstacle[4]; l[Floor4(r)] = k; return l; }
        static Obstacle[] Fill(Obstacle k) => new[] { k, k, k, k };

        static int[] Shuffled(Mulberry32 r)
        {
            var order = new[] { 0, 1, 2, 3 };
            for (int i = 3; i > 0; i--)
            {
                int j = (int)Math.Floor(r.Next() * (i + 1));
                int tmp = order[i];
                order[i] = order[j];
                order[j] = tmp;
            }
            return order;
        }

        static List<Obstacle[]> Slalom(Mulberry32 r, int n)
        {
            int open = Floor4(r);
            int dir = open == 0 ? 1 : open == 3 ? -1 : r.Next() < 0.5 ? -1 : 1;
            var outL = new List<Obstacle[]>();
            for (int i = 0; i < n; i++)
            {
                var lanes = Fill(Obstacle.Crate);
                lanes[open] = Obstacle.None;
                outL.Add(lanes);
                int next = open + dir;
                open = next < 0 || next > 3 ? open - dir : next;
            }
            return outL;
        }

        static double LeadOf(string n) => n == "barrels" || n == "barrels2" ? 16 : 0;
        static double TailOf(string n) => n == "barrels" || n == "barrels2" ? 10 : 0;

        static List<Obstacle[]> Pattern(string name, Mulberry32 r)
        {
            switch (name)
            {
                case "hurdleOne": return new List<Obstacle[]> { PlaceOne(r, Obstacle.Hurdle) };
                case "gateOne": return new List<Obstacle[]> { PlaceOne(r, Obstacle.Gate) };
                case "crateOne": return new List<Obstacle[]> { PlaceOne(r, Obstacle.Crate) };
                case "hurdleWall": return new List<Obstacle[]> { Fill(Obstacle.Hurdle) };
                case "gateWall": return new List<Obstacle[]> { Fill(Obstacle.Gate) };
                case "split":
                {
                    var lanes = new Obstacle[4];
                    for (int i = 0; i < 4; i++) lanes[i] = (int)Math.Floor(r.Next() * 2) == 0 ? Obstacle.None : Obstacle.Hurdle;
                    var sh = Shuffled(r);
                    lanes[sh[0]] = Obstacle.Crate;
                    lanes[sh[1]] = Obstacle.Crate;
                    return new List<Obstacle[]> { lanes };
                }
                case "barrels": return new List<Obstacle[]> { PlaceOne(r, Obstacle.Roller) };
                case "barrels2":
                {
                    var lanes = new Obstacle[4];
                    int a = Floor4(r);
                    lanes[a] = Obstacle.Roller;
                    lanes[(a + 2) % 4] = Obstacle.Roller;
                    return new List<Obstacle[]> { lanes };
                }
                case "tunnel":
                {
                    var lanes = Fill(Obstacle.Crate);
                    int i = Floor4(r);
                    lanes[i] = r.Next() < 0.5 ? Obstacle.Hurdle : Obstacle.None;
                    return new List<Obstacle[]> { lanes };
                }
                case "slalom2": return Slalom(r, 2);
                case "slalom3": return Slalom(r, 3);
                case "combo": return new List<Obstacle[]> { Fill(Obstacle.Hurdle), Fill(Obstacle.Hurdle) };
                case "zigzag":
                {
                    var rows = Slalom(r, 3);
                    for (int i = 0; i < rows.Count; i++)
                        for (int l = 0; l < 4; l++)
                            if (rows[i][l] == Obstacle.None && i % 2 == 1) rows[i][l] = Obstacle.Hurdle;
                    return rows;
                }
            }
            throw new ArgumentException("unknown pattern " + name);
        }

        static double R1(double x) => Math.Floor(x * 10 + 0.5) / 10; // JS Math.round(x*10)/10
        static double C1(double x) => Math.Ceiling(x * 10) / 10;

        /// <summary>The course for a seed (len = Rules.TrackLen for a race, Rules.SurvivalLen for an endless run).</summary>
        public static CourseData Build(uint seed, double len = Rules.TrackLen, double boost = 0)
        {
            var r = new Mulberry32(seed);
            var r2 = new Mulberry32(seed ^ 0x9e3779b9u);
            var r3 = new Mulberry32(seed ^ 0x7f4a7c15u);
            var c = new CourseData { Len = len };
            bool endless = len > Rules.TrackLen;
            var seen = new HashSet<Obstacle>();
            var taught = new HashSet<string>();
            double lastHeart = 0, z = 32, prevZ = 0;
            string last = "";
            int sinceBox = 0, sinceRest = 0;
            var reach = AllRun();

            Action<double> AddBox = bz =>
            {
                int first = (int)Math.Floor(r2.Next() * 4);
                c.Boxes.Add(new LanePoint { Z = R1(bz), Lane = first });
                if (r2.Next() < 0.45) c.Boxes.Add(new LanePoint { Z = R1(bz), Lane = (first + 1 + (int)Math.Floor(r2.Next() * 3)) % 4 });
                sinceBox = 0;
            };

            while (z < len - 40)
            {
                double dz = z + boost;
                var stage = StageAt(dz);
                double speed = Rules.SpeedAtDistance(endless, z);
                double step = speed * stage.React;

                var due = stage.Mix.FindAll(kv =>
                {
                    var fa = FirstAtOf(kv.Key);
                    bool notYet = dz < 250 && fa.HasValue && dz < fa.Value;
                    bool barrelsEarly = kv.Key.StartsWith("barrels") && !seen.Contains(Obstacle.Crate);
                    return !notYet && !barrelsEarly;
                });
                var fresh = due.FindAll(kv => kv.Key != last);
                var mix = fresh.Count > 0 ? fresh : due;
                bool forceRest = endless && sinceRest >= 9 && stage.Breather > 0;
                string lesson = null;
                if (dz < 400) foreach (var kv in FirstAt) if (!taught.Contains(kv.Key) && kv.Value <= dz) { lesson = kv.Key; break; }
                string name = forceRest ? "breather" : lesson ?? mix[mix.Count - 1].Key;
                if (lesson != null) taught.Add(lesson);
                if (!forceRest && lesson == null)
                {
                    double total = 0;
                    foreach (var kv in mix) total += kv.Value;
                    double roll = r.Next() * total;
                    foreach (var kv in mix)
                    {
                        roll -= kv.Value;
                        if (roll <= 0) { name = kv.Key; break; }
                    }
                }
                last = name;

                if (name == "bus")
                {
                    int a = Floor4(r);
                    var lanes = new List<int> { a };
                    if (r.Next() < 0.6) lanes.Add(a == 0 ? 1 : a == 3 ? 2 : r.Next() < 0.5 ? a - 1 : a + 1);
                    if (lanes.Count == 2 && r.Next() < 0.35)
                    {
                        var free = new List<int>();
                        for (int l = 0; l < 4; l++) if (!lanes.Contains(l)) free.Add(l);
                        lanes.Add(free[(int)Math.Floor(r.Next() * free.Count)]);
                    }
                    if (c.Rows.Count > 0 && z - prevZ > Rules.MaxEmptyM - 6) z = prevZ + Rules.MaxEmptyM - 6;
                    double z0 = C1(z + Rules.RampLen);
                    foreach (int lane in lanes)
                    {
                        int look = (int)Math.Floor(r2.Next() * 3);
                        bool ramp = r2.Next() < 0.65;
                        c.Buses.Add(new Bus { Lane = lane, Z0 = z0, Z1 = R1(z0 + Rules.BusLen), Look = look, Ramp = ramp });
                    }
                    z = z0 + Rules.BusLen + Math.Max(10, step * 0.7);
                    prevZ = z0;
                    reach = AllRun();
                    sinceRest += 1;
                    continue;
                }
                if (name == "breather")
                {
                    AddBox(z + step * 0.3);
                    c.Boosts.Add(new LanePoint { Z = R1(z + step * 0.8), Lane = Floor4(r) });
                    z += step * 1.2;
                    sinceRest = 0;
                    continue;
                }
                sinceRest += 1;
                z += LeadOf(name);
                var outRows = Pattern(name, r);
                bool stop = false;
                for (int i = 0; i < outRows.Count; i++)
                {
                    if (stop || z >= len - 40) { stop = true; break; }
                    var lanes = outRows[i];
                    var row = new Row { Lanes = lanes };
                    for (int l = 0; l < 4; l++) row.Looks[l] = lanes[l] != Obstacle.None ? (int)Math.Floor(r2.Next() * LooksOf[lanes[l]]) : 0;
                    var freshK = Obstacle.None;
                    foreach (var k in lanes) if (k != Obstacle.None && !seen.Contains(k)) { freshK = k; break; }
                    if (freshK != Obstacle.None)
                    {
                        seen.Add(freshK);
                        row.Intro = freshK;
                        if (c.Rows.Count > 0) z += step * 0.6;
                    }
                    if (c.Rows.Count > 0 && z - prevZ > Rules.MaxEmptyM) z = prevZ + Rules.MaxEmptyM;
                    double need = WorstNeed(reach, row) * Rules.SpeedAtDistance(endless, prevZ);
                    if (z - prevZ < need) z = prevZ + need + 0.5;
                    row.Z = C1(z);
                    double dt = (row.Z - prevZ) / Rules.SpeedAtDistance(endless, prevZ);
                    reach = NextReach(reach, row, Math.Max(dt, need / Rules.SpeedAtDistance(endless, prevZ)));
                    prevZ = row.Z;
                    c.Rows.Add(row);
                    if (i < outRows.Count - 1) z += step;
                }
                if (stop) break;
                double kk = Math.Min(1, dz / 2400);
                double gap = step * (0.75 + 0.4 * kk + r.Next() * 0.35 * (1 - kk)) + TailOf(name);
                sinceBox += 1;
                if (endless && z - lastHeart > Rules.HeartEveryM)
                {
                    c.Hearts.Add(new LanePoint { Z = R1(z + gap * 0.45), Lane = (int)Math.Floor(r2.Next() * 4) });
                    lastHeart = z;
                }
                if (r.Next() < 0.3) { double bz = R1(z + gap / 2); c.Boosts.Add(new LanePoint { Z = bz, Lane = Floor4(r) }); }
                if (z > 90 && r3.Next() < 0.32) { double sz = R1(z + gap * 0.3); c.Slows.Add(new LanePoint { Z = sz, Lane = (int)Math.Floor(r3.Next() * 4) }); }
                else if (z > 60 && (sinceBox >= 4 || r2.Next() < 0.22)) AddBox(z + gap * 0.55);
                z += gap;
            }
            return c;
        }
    }
}
