import type { Comment, Novel } from './types';

export const SEED_NOVELS: Novel[] = [
  {
    id: '1',
    title: 'Perl僧侶の憂鬱',
    author: 'Kyuu',
    trip: '◆LEGEND05',
    body: `これは 'use strict' の使用を断固として拒んだ男の物語である。

サーバー室は暗く、外は嵐が吹き荒れていた。エラーログは驚くべき速度で埋め尽くされていく。「Premature end of script headers...」彼は呟き、厳格な禁煙ポリシーを無視してタバコに火をつけた。

（続く...）`,
    date: '2005-05-23T14:30:00+09:00',
    viewCount: 1543,
  },
  {
    id: '2',
    title: '正規表現に転生した件について',
    author: 'RegExWizard',
    date: '2005-05-24T09:15:00+09:00',
    body: `目が覚めると、私はもはや人間ではなかった。私はキャプチャグループに分割されていたのだ。

/([a-z]+)@([a-z]+)/

私の人生は今や、純粋なパターンマッチングに過ぎない。`,
    viewCount: 890,
  },
  {
    id: '3',
    title: '404号室のメモリリーク',
    author: 'HeapHunter',
    body: `夜中の3時、タスクマネージャだけが真実を知っていた。

プロセスは静かに肥大化し、誰にも気づかれずに息を吸い続ける。私はログを追い、finally節の置き忘れを見つけた。`,
    date: '2005-05-24T22:40:00+09:00',
    viewCount: 742,
  },
  {
    id: '4',
    title: '深夜2時のSQL反省会',
    author: 'DBA見習い',
    trip: '◆DBA2AM',
    body: `DELETE 文に WHERE を書き忘れたあの夜、私は大人になった。

バックアップは神話ではない。検証済みの復旧手順だけが、明日を保証する。`,
    date: '2005-05-25T02:05:00+09:00',
    viewCount: 1210,
  },
  {
    id: '5',
    title: 'CSSが泣いた日',
    author: 'Float職人',
    body: `float と clear に全てを託した時代が確かにあった。

レイアウトが1pxずれるたびに、私はブラウザごとの差分と和解する術を覚えていく。`,
    date: '2005-05-25T11:30:00+09:00',
    viewCount: 665,
  },
];

export const SEED_COMMENTS: Comment[] = [
  { id: 'c1', novelId: '1', name: 'ファン', text: '更新はよ！', date: '2005-05-23T15:00:00+09:00', vote: 2 },
  { id: 'c2', novelId: '1', name: '辛口評論家', text: '短すぎる。', date: '2005-05-23T16:20:00+09:00', vote: -1 },
  { id: 'c3', novelId: '2', name: '774', text: '興味深いコンセプトだ。', date: '2005-05-24T10:00:00+09:00', vote: 1 },
  { id: 'c4', novelId: '4', name: '匿名DBA', text: 'WHERE は大事。', date: '2005-05-25T03:10:00+09:00', vote: 2 },
  { id: 'c5', novelId: '5', name: 'レトロ派', text: 'float時代の苦労、わかる。', date: '2005-05-25T12:00:00+09:00', vote: 1 },
];
