"""Create a 50-game stress dataset for layout validation.

Clones existing media folders so every entry has real artwork, then appends
entries with varied names, genres, playtime and play counts.
"""
import json
import os
import random
import shutil
import uuid

ROOT = r'C:/Users/12290/AppData/Local/NOVA Game Space'
LIB_PATH = os.path.join(ROOT, 'library.json')
MEDIA = os.path.join(ROOT, 'media')

with open(LIB_PATH, encoding='utf-8') as fh:
    data = json.load(fh)

base_games = list(data['games'])
existing_media = [g['id'] for g in data['games'] if os.path.isdir(os.path.join(MEDIA, g['id']))]

adjectives = ['Silent', 'Crimson', 'Verdant', 'Hollow', 'Gilded', 'Neon', 'Frozen', 'Iron',
              'Velvet', 'Distant', 'Lunar', 'Solar', 'Ashen', 'Amber', 'Cobalt', 'Fractal',
              'Quiet', 'Wild', 'Ancient', 'Burning']
nouns = ['Odyssey', 'Requiem', 'Frontier', 'Garden', 'Covenant', 'Circuit', 'Harbor', 'Eclipse',
         'Machina', 'Bloom', 'Reverie', 'Spire', 'Tide', 'Ember', 'Signal', 'Cascade',
         'Protocol', 'Lullaby', 'Vanguard', 'Atlas']
zh_pairs = [('星海', '回响'), ('赤色', '边境'), ('静谧', '花园'), ('机械', '黎明'),
            ('月下', '誓约'), ('冰雪', '列车'), ('琥珀', '之城'), ('虚空', '旅人')]

random.seed(42)
needed = max(0, 50 - len(data['games']))
created = []

for i in range(needed):
    gid = uuid.uuid4().hex
    src = existing_media[i % len(existing_media)]
    src_dir = os.path.join(MEDIA, src)
    dst_dir = os.path.join(MEDIA, gid)
    os.makedirs(dst_dir, exist_ok=True)
    for fname in ('hero.jpg', 'cover.jpg'):
        source_file = os.path.join(src_dir, fname)
        if os.path.exists(source_file):
            shutil.copyfile(source_file, os.path.join(dst_dir, fname))

    name = f'{adjectives[i % len(adjectives)]} {nouns[(i * 7) % len(nouns)]}'
    zh = ''.join(zh_pairs[i % len(zh_pairs)])
    template = base_games[i % len(base_games)]
    game = dict(template)
    game.update({
        'id': gid,
        'name': name,
        'zh': zh,
        'exePath': 'C:/Windows/System32/notepad.exe',
        'workDir': 'C:/Windows/System32',
        'heroPath': os.path.join(dst_dir, 'hero.jpg').replace('/', os.sep),
        'coverPath': os.path.join(dst_dir, 'cover.jpg').replace('/', os.sep),
        'source': 'manual',
        'steamAppId': None,
        'playtimeSeconds': random.randint(0, 400000),
        'favorite': random.random() < 0.25,
        'launchCount': random.randint(0, 40),
        'lastPlayedUtc': None,
        'description': '压力测试样本数据，用于检验五十款游戏时的布局与滚动表现。',
        'tagline': '一份用于压力测试的示例条目。',
        'genre': ['动作', '冒险', '角色扮演', '策略', '模拟', '解谜'][i % 6],
    })
    data['games'].append(game)
    created.append(name)

data['settings']['calm'] = False
with open(LIB_PATH, 'w', encoding='utf-8') as fh:
    json.dump(data, fh, ensure_ascii=False, indent=2)

print('games now:', len(data['games']), '| created:', len(created))
