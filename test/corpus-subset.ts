// Cases copied verbatim, one JSON object per line, from the conformance
// corpus of the Elixir uxid package at its tag v2.10.0: a hand-picked subset of
// conformance/encode.json, every line of conformance/deterministic.json, and
// the lines of conformance/invalid.json whose generation errors `generate` can
// raise. The full corpus replaces them once it is vendored and run case by
// case.

export const encodeCases = `{"expected":"usr_01hf7yat00","id":"encode/xs-standard-lower","input":{"case":"lower","compact":false,"prefix":"usr","rand":"","size":"xs","time":1700000000000}}
{"expected":"usr_HF7YAT0001","id":"encode/xs-compact-upper","input":{"case":"upper","compact":true,"prefix":"usr","rand":"01","size":"xs","time":1700000000000}}
{"expected":"usr_01hf7yat0004h1","id":"encode/s-standard-lower","input":{"case":"lower","compact":false,"prefix":"usr","rand":"0123","size":"s","time":1700000000000}}
{"expected":"usr_hf7yat0004hm5","id":"encode/s-compact-lower","input":{"case":"lower","compact":true,"prefix":"usr","rand":"012345","size":"s","time":1700000000000}}
{"expected":"usr_01HF7YAT0004HMASW9","id":"encode/m-standard-upper","input":{"case":"upper","compact":false,"prefix":"usr","rand":"0123456789","size":"m","time":1700000000000}}
{"expected":"usr_hf7yat0004hmasw9n3","id":"encode/m-compact-lower","input":{"case":"lower","compact":true,"prefix":"usr","rand":"0123456789ab","size":"m","time":1700000000000}}
{"expected":"usr_01hf7yat0004hmasw9nf61","id":"encode/l-standard-lower","input":{"case":"lower","compact":false,"prefix":"usr","rand":"0123456789abcd","size":"l","time":1700000000000}}
{"expected":"usr_HF7YAT0004HMASW9NF6YF","id":"encode/l-compact-upper","input":{"case":"upper","compact":true,"prefix":"usr","rand":"0123456789abcdef","size":"l","time":1700000000000}}
{"expected":"usr_01hf7yat0004hmasw9nf6yy093","id":"encode/xl-standard-lower","input":{"case":"lower","compact":false,"prefix":"usr","rand":"0123456789abcdef0123","size":"xl","time":1700000000000}}
{"expected":"usr_HF7YAT0004HMASW9NF6YY093","id":"encode/xl-compact-upper","input":{"case":"upper","compact":true,"prefix":"usr","rand":"0123456789abcdef0123","size":"xl","time":1700000000000}}
{"expected":"cus_hf7yat00z7","id":"encode/xs-compact-rand-all-ones","input":{"case":"lower","compact":true,"prefix":"cus","rand":"ff","size":"xs","time":1700000000000}}
{"expected":"cus_01hf7yat00zzz1","id":"encode/s-standard-rand-all-ones","input":{"case":"lower","compact":false,"prefix":"cus","rand":"ffff","size":"s","time":1700000000000}}
{"expected":"cus_hf7yat00zzzzf","id":"encode/s-compact-rand-all-ones","input":{"case":"lower","compact":true,"prefix":"cus","rand":"ffffff","size":"s","time":1700000000000}}
{"expected":"cus_01hf7yat00zzzzzzzzzzz1","id":"encode/l-standard-rand-all-ones","input":{"case":"lower","compact":false,"prefix":"cus","rand":"ffffffffffffff","size":"l","time":1700000000000}}
{"expected":"0000000000","id":"encode/xs-standard-time-zero","input":{"case":"lower","compact":false,"prefix":null,"rand":"","size":"xs","time":0}}
{"expected":"7zzzzzzzzz","id":"encode/xs-standard-time-max","input":{"case":"lower","compact":false,"prefix":null,"rand":"","size":"xs","time":281474976710655}}
{"expected":"usr_yzzzzzzz04hm5","id":"encode/s-compact-guard-last-valid","input":{"case":"lower","compact":true,"prefix":"usr","rand":"012345","size":"s","time":1065151889407}}
{"expected":"01hf7yat0004hmasw9nf6yy093","id":"encode/xl-standard-no-prefix","input":{"case":"lower","compact":false,"prefix":null,"rand":"0123456789abcdef0123","size":"xl","time":1700000000000}}
{"expected":"01hf7yat0004hmasw9nf6yy093","id":"encode/xl-standard-empty-prefix","input":{"case":"lower","compact":false,"prefix":"","rand":"0123456789abcdef0123","size":"xl","time":1700000000000}}
{"expected":"a_b_01hf7yat0004h1","id":"encode/s-standard-prefix-with-delimiter","input":{"case":"lower","compact":false,"prefix":"a_b","rand":"0123","size":"s","time":1700000000000}}
`;

export const generateRefusalCases = `{"expected_error":"compact_time_out_of_range","id":"invalid/generate-compact-time-at-guard","input":{"generate":{"compact":true,"prefix":"usr","rand":"010203","size":"s","time":2164663517184}}}
{"expected_error":"compact_time_out_of_range","id":"invalid/generate-compact-time-at-guard-previous-window","input":{"generate":{"compact":true,"prefix":"usr","rand":"010203","size":"s","time":1065151889408}}}
{"expected_error":"rand_width_mismatch","id":"invalid/generate-rand-too-wide","input":{"generate":{"prefix":"usr","rand":"010203","size":"s","time":1700000000000}}}
{"expected_error":"rand_width_mismatch","id":"invalid/generate-rand-too-narrow","input":{"generate":{"prefix":"usr","rand":"010203040506070809","size":"xl","time":1700000000000}}}
{"expected_error":"rand_width_mismatch","id":"invalid/generate-rand-on-xs-standard","input":{"generate":{"prefix":"usr","rand":"01","size":"xs","time":1700000000000}}}
{"expected_error":"rand_size_too_large","id":"invalid/generate-rand-size-11","input":{"generate":{"prefix":"usr","rand_size":11,"size":"xl","time":1700000000000}}}
`;

export const deterministicCases = `{"expected":"usr_zcvt7epac0t1ebcsjfyf7cwz25","id":"deterministic/golden-usr-xl","input":{"case":"lower","from":"alice@example.com","prefix":"usr","size":"xl"}}
{"expected":"cus_zt9vnyfd85bff0","id":"deterministic/golden-cus-s","input":{"case":"lower","from":"acme-corp","prefix":"cus","size":"s"}}
{"expected":"zqz4cwzgyw8ks97869","id":"deterministic/golden-no-prefix-m","input":{"case":"lower","from":"alice@example.com","prefix":null,"size":"m"}}
{"expected":"usr_z1yhw20vag","id":"deterministic/usr-xs","input":{"case":"lower","from":"alice@example.com","prefix":"usr","size":"xs"}}
{"expected":"usr_z5rtsrkhx2h4dr","id":"deterministic/usr-s","input":{"case":"lower","from":"alice@example.com","prefix":"usr","size":"s"}}
{"expected":"usr_zt8naccefxhwnrmscd","id":"deterministic/usr-m","input":{"case":"lower","from":"alice@example.com","prefix":"usr","size":"m"}}
{"expected":"usr_zwbz6myvgz7ehe3nceap5n","id":"deterministic/usr-l","input":{"case":"lower","from":"alice@example.com","prefix":"usr","size":"l"}}
{"expected":"usr_zcvt7epac0t1ebcsjfyf7cwz25","id":"deterministic/usr-xl","input":{"case":"lower","from":"alice@example.com","prefix":"usr","size":"xl"}}
{"expected":"z4krgegf6drn563pvqhya4tsx9","id":"deterministic/empty-prefix-xl","input":{"case":"lower","from":"alice@example.com","prefix":"","size":"xl"}}
{"expected":"z4krgegf6drn563pvqhya4tsx9","id":"deterministic/no-prefix-xl","input":{"case":"lower","from":"alice@example.com","prefix":null,"size":"xl"}}
{"expected":"usr_ZCVT7EPAC0T1EBCSJFYF7CWZ25","id":"deterministic/usr-xl-upper","input":{"case":"upper","from":"alice@example.com","prefix":"usr","size":"xl"}}
{"expected":"cus_zfsx9se75671f9kdjv","id":"deterministic/non-ascii-from-m","input":{"case":"lower","from":"café","prefix":"cus","size":"m"}}
`;

export const deterministicRefusalCases = `{"expected_error":"rand_with_from","id":"invalid/generate-rand-with-from","input":{"generate":{"from":"alice@example.com","prefix":"usr","rand":"00010203040506070809"}}}
`;
