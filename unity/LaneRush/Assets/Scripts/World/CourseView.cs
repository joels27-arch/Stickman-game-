// Shows the course: obstacles, buses with ramps, boost and slow pads, mystery boxes, hearts and
// coin trails. Only what's near the runner exists (built ahead, removed behind).
using System.Collections.Generic;
using UnityEngine;

namespace LaneRush
{
    public enum ItemKind { Hurdle, Gate, Crate, Roller, Bus, Boost, Slow, Box, Heart, Coin }

    public sealed class CourseItem
    {
        public ItemKind Kind;
        public double Z, Z1; // Z1: a bus's far end
        public int Lane;
        public bool Ramp;
        public int Look;
        public GameObject Go;
        public bool Taken; // a pickup you have, or a barrel that already rolled past
        public bool Rolling;
        public double RollFrom; // run time when a barrel started rolling
    }

    public sealed class CourseView : MonoBehaviour
    {
        public const double RollerSpeed = 6, RollerTrigger = 34;
        const float Ahead = 170f, Behind = 25f;

        public CourseData Course { get; private set; }
        public readonly List<CourseItem> Items = new List<CourseItem>();
        public readonly List<CourseItem> Coins = new List<CourseItem>();
        int next; // the next item to build (Items is sorted by Z)
        int nextCoin;
        MapTheme theme;
        Transform root;

        public void Build(CourseData course, MapTheme t, uint seed)
        {
            Course = course;
            theme = t;
            if (root != null) Destroy(root.gameObject);
            root = new GameObject("Course").transform;
            root.SetParent(transform, false);
            Items.Clear();
            Coins.Clear();
            next = nextCoin = 0;
            foreach (var r in course.Rows)
                for (int l = 0; l < 4; l++)
                    if (r.Lanes[l] != Obstacle.None)
                        Items.Add(new CourseItem { Kind = (ItemKind)((int)r.Lanes[l] - 1), Z = r.Z, Lane = l, Look = r.Looks[l] });
            foreach (var b in course.Buses) Items.Add(new CourseItem { Kind = ItemKind.Bus, Z = b.Z0, Z1 = b.Z1, Lane = b.Lane, Ramp = b.Ramp, Look = b.Look });
            foreach (var p in course.Boosts) Items.Add(new CourseItem { Kind = ItemKind.Boost, Z = p.Z, Lane = p.Lane });
            foreach (var p in course.Slows) Items.Add(new CourseItem { Kind = ItemKind.Slow, Z = p.Z, Lane = p.Lane });
            foreach (var p in course.Boxes) Items.Add(new CourseItem { Kind = ItemKind.Box, Z = p.Z, Lane = p.Lane });
            foreach (var p in course.Hearts) Items.Add(new CourseItem { Kind = ItemKind.Heart, Z = p.Z, Lane = p.Lane });
            Items.Sort((a, b) => (a.Kind == ItemKind.Bus ? a.Z - Rules.RampLen : a.Z).CompareTo(b.Kind == ItemKind.Bus ? b.Z - Rules.RampLen : b.Z));
            MakeCoins(seed);
        }

        /// <summary>Coin trails: 8 coins in a lane that's free (on bus roofs too), every so often.</summary>
        void MakeCoins(uint seed)
        {
            var rnd = new System.Random((int)(seed % int.MaxValue) + 1);
            for (double z = 45; z < Course.Len - 40; z += 38 + rnd.NextDouble() * 22)
            {
                int lane = rnd.Next(4);
                for (int k = 0; k < 8; k++)
                {
                    double cz = z + k * 1.8;
                    if (Blocked(lane, cz)) continue;
                    Coins.Add(new CourseItem { Kind = ItemKind.Coin, Z = cz, Lane = lane });
                }
            }
        }

        bool Blocked(int lane, double z)
        {
            foreach (var r in Course.Rows)
            {
                if (r.Z > z + 3) break;
                if (r.Z > z - 3 && (r.Lanes[lane] == Obstacle.Crate || r.Lanes[lane] == Obstacle.Roller || r.Lanes[lane] == Obstacle.Hurdle)) return true;
            }
            foreach (var b in Course.Buses) if (b.Lane == lane && !b.Ramp && z > b.Z0 - 4 && z < b.Z0) return true;
            return false;
        }

        /// <summary>Build what's coming, drop what's behind, roll the barrels.</summary>
        public void Tick(double d, double runTime)
        {
            while (next < Items.Count && Items[next].Z - Rules.RampLen < d + Ahead) Spawn(Items[next++]);
            while (nextCoin < Coins.Count && Coins[nextCoin].Z < d + Ahead) Spawn(Coins[nextCoin++]);
            for (int i = 0; i < next; i++) Animate(Items[i], d, runTime);
            for (int i = 0; i < nextCoin; i++)
            {
                var c = Coins[i];
                if (c.Go == null) continue;
                if (c.Z < d - Behind || c.Taken) { Destroy(c.Go); c.Go = null; continue; }
                c.Go.transform.localRotation = Quaternion.Euler(90, (float)runTime * 220f, 0);
            }
        }

        void Animate(CourseItem it, double d, double runTime)
        {
            if (it.Go == null) return;
            double end = it.Kind == ItemKind.Bus ? it.Z1 : it.Z;
            if (end < d - Behind || (it.Taken && it.Kind != ItemKind.Roller)) { Destroy(it.Go); it.Go = null; return; }
            if (it.Kind == ItemKind.Roller)
            {
                double z = RollerZ(it, d, runTime);
                var p = it.Go.transform.localPosition;
                it.Go.transform.localPosition = new Vector3(p.x, p.y, (float)z);
                if (it.Rolling) it.Go.transform.localRotation = Quaternion.Euler((float)(-(runTime - it.RollFrom) * RollerSpeed / 0.5 * Mathf.Rad2Deg), 0, 90);
            }
            else if (it.Kind == ItemKind.Box || it.Kind == ItemKind.Heart)
            {
                it.Go.transform.localRotation = Quaternion.Euler(it.Kind == ItemKind.Box ? 20 : 0, (float)runTime * 90f, 0);
                var p = it.Go.transform.localPosition;
                it.Go.transform.localPosition = new Vector3(p.x, BaseY(it) + 1.1f + Mathf.Sin((float)runTime * 3f) * 0.12f, p.z);
            }
        }

        /// <summary>Where a barrel is now: it starts rolling toward you when you get close.</summary>
        public double RollerZ(CourseItem it, double d, double runTime)
        {
            if (!it.Rolling && it.Z - d < RollerTrigger) { it.Rolling = true; it.RollFrom = runTime; }
            return it.Rolling ? it.Z - (runTime - it.RollFrom) * RollerSpeed : it.Z;
        }

        float BaseY(CourseItem it) => (float)Course.FloorAt(it.Lane, it.Z);

        void Spawn(CourseItem it)
        {
            var t = theme;
            float x = World.LaneX(it.Lane);
            float z = (float)it.Z;
            var g = new GameObject(it.Kind.ToString()).transform;
            g.SetParent(root, false);
            g.localPosition = new Vector3(x, 0, z);
            it.Go = g.gameObject;
            switch (it.Kind)
            {
                case ItemKind.Hurdle:
                {
                    var bar = Mats.Lit(it.Look == 0 ? new Color(0.95f, 0.25f, 0.2f) : new Color(1f, 0.8f, 0.2f), 0.4f);
                    Mats.Prim(PrimitiveType.Cube, bar, g, new Vector3(0, 0.62f, 0), new Vector3(1.75f, 0.16f, 0.12f));
                    Mats.Prim(PrimitiveType.Cube, Mats.Lit(Color.white, 0.4f), g, new Vector3(0, 0.42f, 0), new Vector3(1.75f, 0.1f, 0.1f));
                    foreach (int s in new[] { -1, 1 }) Mats.Prim(PrimitiveType.Cube, Mats.Lit(Color.white, 0.4f), g, new Vector3(s * 0.82f, 0.36f, 0), new Vector3(0.1f, 0.72f, 0.1f));
                    break;
                }
                case ItemKind.Gate:
                    foreach (int s in new[] { -1, 1 }) Mats.Prim(PrimitiveType.Cube, Mats.Lit(Color.white), g, new Vector3(s * 0.9f, 1.1f, 0), new Vector3(0.15f, 2.2f, 0.15f));
                    Mats.Prim(PrimitiveType.Cube, Mats.Lit(t.Prop), g, new Vector3(0, 1.45f, 0), new Vector3(1.95f, 0.5f, 0.2f));
                    break;
                case ItemKind.Crate:
                {
                    var col = Color.Lerp(t.Prop, new Color(0.75f, 0.5f, 0.25f), it.Look == 0 ? 0.7f : it.Look == 1 ? 0.35f : 0f);
                    Mats.Prim(PrimitiveType.Cube, Mats.Lit(col, 0.2f), g, new Vector3(0, 0.7f, 0), new Vector3(1.45f, 1.4f, 1.3f));
                    Mats.Prim(PrimitiveType.Cube, Mats.Lit(col * 0.85f, 0.2f), g, new Vector3(0.05f, 1.95f, 0), new Vector3(1.2f, 1.1f, 1.1f));
                    break;
                }
                case ItemKind.Roller:
                {
                    var barrel = Mats.Prim(PrimitiveType.Cylinder, Mats.Lit(new Color(0.55f, 0.32f, 0.15f), 0.3f), g, new Vector3(0, 0.5f, 0), new Vector3(1f, 0.7f, 1f));
                    barrel.transform.localRotation = Quaternion.Euler(0, 0, 90);
                    break;
                }
                case ItemKind.Bus:
                {
                    float len = (float)(it.Z1 - it.Z);
                    var body = it.Look == 0 ? new Color(1f, 0.8f, 0.15f) : it.Look == 1 ? new Color(0.2f, 0.75f, 0.85f) : new Color(0.95f, 0.35f, 0.3f);
                    float h = (float)Rules.BusH;
                    Mats.Prim(PrimitiveType.Cube, Mats.Lit(body, 0.5f), g, new Vector3(0, h / 2, len / 2), new Vector3(1.8f, h, len));
                    Mats.Prim(PrimitiveType.Cube, Mats.Lit(new Color(0.15f, 0.2f, 0.3f), 0.8f), g, new Vector3(0, h * 0.62f, len / 2), new Vector3(1.84f, h * 0.3f, len * 0.92f));
                    Mats.Prim(PrimitiveType.Cube, Mats.Lit(body * 0.8f, 0.3f), g, new Vector3(0, h + 0.03f, len / 2), new Vector3(1.6f, 0.06f, len - 0.4f));
                    foreach (float wz in new[] { 1.8f, len - 1.8f })
                        foreach (int s in new[] { -1, 1 })
                        {
                            var wheel = Mats.Prim(PrimitiveType.Cylinder, Mats.Lit(new Color(0.1f, 0.1f, 0.1f)), g, new Vector3(s * 0.85f, 0.4f, wz), new Vector3(0.8f, 0.1f, 0.8f));
                            wheel.transform.localRotation = Quaternion.Euler(0, 0, 90);
                        }
                    if (it.Ramp)
                    {
                        float rl = (float)Rules.RampLen;
                        float slope = Mathf.Sqrt(rl * rl + h * h);
                        var ramp = Mats.Prim(PrimitiveType.Cube, Mats.Lit(new Color(1f, 0.55f, 0.15f), 0.3f), g, new Vector3(0, h / 2 - 0.05f, -rl / 2), new Vector3(1.7f, 0.12f, slope));
                        ramp.transform.localRotation = Quaternion.Euler(-Mathf.Atan2(h, rl) * Mathf.Rad2Deg, 0, 0);
                    }
                    break;
                }
                case ItemKind.Boost:
                {
                    var pad = Mats.Prim(PrimitiveType.Cube, Mats.Glow(new Color(0.4f, 1f, 0.3f), 0.9f), g, new Vector3(0, BaseY(it) + 0.02f, 0), new Vector3(1.5f, 0.04f, 2.2f));
                    Mats.Prim(PrimitiveType.Cube, Mats.Glow(Color.white, 0.6f), pad.transform, new Vector3(0, 0.6f, 0.15f), new Vector3(0.18f, 0.5f, 0.45f)).transform.localRotation = Quaternion.Euler(0, 45, 0);
                    break;
                }
                case ItemKind.Slow:
                    Mats.Prim(PrimitiveType.Cube, Mats.Glow(new Color(1f, 0.25f, 0.25f), 0.8f), g, new Vector3(0, BaseY(it) + 0.02f, 0), new Vector3(1.5f, 0.04f, 2.2f));
                    break;
                case ItemKind.Box:
                    Mats.Prim(PrimitiveType.Cube, Mats.Lit(new Color(1f, 0.75f, 0.1f), 0.6f), g, Vector3.zero, Vector3.one * 0.85f).name = "Mystery box";
                    Mats.Prim(PrimitiveType.Cube, Mats.Glow(new Color(1f, 0.55f, 0.1f), 0.5f), g, Vector3.zero, Vector3.one * 0.9f).transform.localScale = new Vector3(0.9f, 0.2f, 0.9f);
                    g.localPosition = new Vector3(x, BaseY(it) + 1.1f, z);
                    break;
                case ItemKind.Heart:
                    foreach (int s in new[] { -1, 1 }) Mats.Prim(PrimitiveType.Sphere, Mats.Glow(new Color(1f, 0.2f, 0.35f), 0.6f), g, new Vector3(s * 0.17f, 0.1f, 0), Vector3.one * 0.42f);
                    var tip = Mats.Prim(PrimitiveType.Cube, Mats.Glow(new Color(1f, 0.2f, 0.35f), 0.6f), g, new Vector3(0, -0.12f, 0), Vector3.one * 0.36f);
                    tip.transform.localRotation = Quaternion.Euler(0, 0, 45);
                    g.localPosition = new Vector3(x, BaseY(it) + 1.1f, z);
                    break;
                case ItemKind.Coin:
                    Mats.Prim(PrimitiveType.Cylinder, Mats.Lit(new Color(1f, 0.82f, 0.2f), 0.8f, 0.6f), g, Vector3.zero, new Vector3(0.6f, 0.05f, 0.6f));
                    g.localPosition = new Vector3(x, BaseY(it) + 0.9f, z);
                    break;
            }
        }
    }
}
