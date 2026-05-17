
import pandas as pd
import pylife.materialdata.woehler as woehler

data = []
for line in '300, 10000, 1\n280, 50000, 1\n190, 500000, 0'.split('
'):
    parts = [float(x.strip()) for x in line.split(',')]
    data.append({'load': parts[0], 'cycles': parts[1], 'fracture': bool(parts[2])})

df = pd.DataFrame(data)

# Convert to pylife fatigue data
fd = woehler.FatigueData(df)

# MaxLikeInf
res = woehler.MaxLikeInf(fd).analyze()
print(res.to_dict())
