// Prints courses for a few seeds (used by check-course-parity.sh to compare with the web game).
using System; using System.Text; using LaneRush;
static class P { static void Main(string[] a) {
  var sb = new StringBuilder();
  foreach (var s in new uint[]{1, 42, 123456, 987654321, 4000000000}) foreach (var len in new double[]{700, 9000}) {
    var c = CourseBuilder.Build(s, len);
    sb.Append("seed ").Append(s).Append(" len ").Append(len).Append('\n');
    foreach (var r in c.Rows) { sb.Append("R ").Append(r.Z.ToString("R")); foreach (var k in r.Lanes) sb.Append(' ').Append((int)k); foreach (var k in r.Looks) sb.Append(' ').Append(k); sb.Append(' ').Append((int)r.Intro).Append('\n'); }
    foreach (var b in c.Buses) sb.Append("B ").Append(b.Lane).Append(' ').Append(b.Z0.ToString("R")).Append(' ').Append(b.Z1.ToString("R")).Append(' ').Append(b.Look).Append(' ').Append(b.Ramp?1:0).Append('\n');
    foreach (var p in c.Boosts) sb.Append("U ").Append(p.Z.ToString("R")).Append(' ').Append(p.Lane).Append('\n');
    foreach (var p in c.Slows) sb.Append("S ").Append(p.Z.ToString("R")).Append(' ').Append(p.Lane).Append('\n');
    foreach (var p in c.Boxes) sb.Append("X ").Append(p.Z.ToString("R")).Append(' ').Append(p.Lane).Append('\n');
    foreach (var p in c.Hearts) sb.Append("H ").Append(p.Z.ToString("R")).Append(' ').Append(p.Lane).Append('\n');
  }
  Console.Write(sb.ToString());
}}
