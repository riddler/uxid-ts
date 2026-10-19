// Cases copied verbatim, one JSON object per line, from the conformance
// corpus of the Elixir uxid package at its tag v2.10.0: a hand-picked subset of
// conformance/encode.json, every line of conformance/deterministic.json and
// of conformance/decode.json, and the lines of conformance/invalid.json whose
// generation errors `generate` can raise or whose input is decoded. The full
// corpus replaces them once it is vendored and run case by case.

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

export const decodeCases = `{"expected":{"compact":false,"deterministic":false,"prefix":"usr","size":"xl","time":1700000000000},"id":"decode/xl-standard","input":"usr_01hf7yat0004hmasw9nf6yy093"}
{"expected":{"compact":true,"deterministic":false,"prefix":"usr","size":"xl","time":1700000000000},"id":"decode/xl-compact","input":"usr_hf7yat0004hmasw9nf6yy093"}
{"expected":{"compact":false,"deterministic":false,"prefix":"usr","size":"l","time":1700000000000},"id":"decode/l-standard","input":"usr_01hf7yat0004hmasw9nf61"}
{"expected":{"compact":true,"deterministic":false,"prefix":"usr","size":"l","time":1700000000000},"id":"decode/l-compact","input":"usr_hf7yat0004hmasw9nf6yf"}
{"expected":{"compact":false,"deterministic":false,"prefix":"usr","size":"m","time":1700000000000},"id":"decode/m-standard","input":"usr_01hf7yat0004hmasw9"}
{"expected":{"compact":false,"deterministic":false,"prefix":"usr","size":"m","time":51950139736068},"id":"decode/m-compact-reads-as-standard","input":"usr_hf7yat0004hmasw9n3"}
{"expected":{"compact":false,"deterministic":false,"prefix":"usr","size":"s","time":1700000000000},"id":"decode/s-standard","input":"usr_01hf7yat0004h1"}
{"expected":{"compact":true,"deterministic":false,"prefix":"usr","size":"s","time":1700000000000},"id":"decode/s-compact","input":"usr_hf7yat0004hm5"}
{"expected":{"compact":false,"deterministic":false,"prefix":"usr","size":"xs","time":1700000000000},"id":"decode/xs-standard","input":"usr_01hf7yat00"}
{"expected":{"compact":false,"deterministic":false,"prefix":"usr","size":"xs","time":51950139736065},"id":"decode/xs-compact-reads-as-standard","input":"usr_hf7yat0001"}
{"expected":{"compact":false,"deterministic":false,"prefix":"usr","size":"xl","time":1700000000000},"id":"decode/xl-standard-upper","input":"usr_01HF7YAT0004HMASW9NF6YY093"}
{"expected":{"compact":false,"deterministic":false,"prefix":null,"size":"xl","time":1700000000000},"id":"decode/xl-standard-no-prefix","input":"01hf7yat0004hmasw9nf6yy093"}
{"expected":{"compact":false,"deterministic":false,"prefix":"a_b","size":"s","time":1700000000000},"id":"decode/s-standard-prefix-with-delimiter","input":"a_b_01hf7yat000001"}
{"expected":{"compact":true,"deterministic":false,"prefix":"usr","size":"s","time":1065151889407},"id":"decode/s-compact-guard-last-valid","input":"usr_yzzzzzzz04hm5"}
{"expected":{"compact":false,"deterministic":true,"prefix":"usr","size":"xl","time":null},"id":"decode/deterministic-usr-xl","input":"usr_zcvt7epac0t1ebcsjfyf7cwz25"}
{"expected":{"compact":false,"deterministic":true,"prefix":"cus","size":"s","time":null},"id":"decode/deterministic-cus-s","input":"cus_zt9vnyfd85bff0"}
{"expected":{"compact":false,"deterministic":true,"prefix":null,"size":"m","time":null},"id":"decode/deterministic-no-prefix-m","input":"zqz4cwzgyw8ks97869"}
{"expected":{"compact":false,"deterministic":true,"prefix":"usr","size":"xl","time":null},"id":"decode/deterministic-upper-marker","input":"usr_ZCVT7EPAC0T1EBCSJFYF7CWZ25"}
`;

export const decodeRefusalCases = `{"expected_error":"empty","id":"invalid/decode-empty-string","input":{"decode":""}}
{"expected_error":"empty","id":"invalid/decode-ends-in-delimiter","input":{"decode":"usr_"}}
{"expected_error":"empty","id":"invalid/decode-prefix-with-delimiter-ends-in-delimiter","input":{"decode":"a_b_"}}
{"expected_error":"empty","id":"invalid/decode-delimiter-only","input":{"decode":"_"}}
{"expected_error":"invalid_length","id":"invalid/decode-length-11","input":{"decode":"usr_01hf7yat000"}}
{"expected_error":"invalid_length","id":"invalid/decode-length-25","input":{"decode":"usr_01hf7yat00000g40r40m30e20"}}
{"expected_error":"invalid_length","id":"invalid/decode-length-27","input":{"decode":"usr_01hf7yat00000g40r40m30e2090"}}
{"expected_error":"invalid_length","id":"invalid/decode-no-delimiter-short","input":{"decode":"usr"}}
{"expected_error":"invalid_character","id":"invalid/decode-character-in-time","input":{"decode":"usr_01hu7yat00000g40r40m30e209"}}
{"expected_error":"invalid_character","id":"invalid/decode-character-in-random","input":{"decode":"usr_01hf7yat00000g4lr40m30e209"}}
{"expected_error":"invalid_character","id":"invalid/decode-upper-o-in-random","input":{"decode":"usr_01hf7yat00000g40r40mO0e209"}}
{"expected_error":"invalid_character","id":"invalid/decode-hyphen-in-body","input":{"decode":"usr_01hf7yat00-00g40r40m30e209"}}
{"expected_error":"invalid_character","id":"invalid/decode-character-in-deterministic","input":{"decode":"usr_zcvt7epac0t1ebcsjfyf7cwzi5"}}
{"expected_error":"invalid_character","id":"invalid/decode-non-ascii-table-length","input":{"decode":"01hf7yat00000g40r40m30e2é"}}
{"expected_error":"invalid_length","id":"invalid/decode-non-ascii-off-table-length","input":{"decode":"01hf7yat00000g40r40m30e20é"}}
{"expected_error":"invalid_length","id":"invalid/decode-length-and-character","input":{"decode":"usr_01hf7yat00u"}}
`;
