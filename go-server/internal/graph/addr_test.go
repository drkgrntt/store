package graph_test

// Address resolvers + User address fields. Node reference:
// server/src/resolvers/{address,user}.ts, server/src/models/Address.ts.

import (
	"testing"

	"storeapi/internal/models"
)

const addrFields = `id recipient lineOne lineTwo city state zipCode country type userId createdAt updatedAt`

const addrCreate = `mutation($lt:String,$ty:String!){ createAddress(recipient:"R",lineOne:"1 Main",lineTwo:$lt,city:"C",state:"S",zipCode:"12345",type:$ty){ ` + addrFields + ` } }`

func addrMake(t *testing.T, e *Env, u *models.User, typ string) string {
	t.Helper()
	r := authDo(e,addrCreate, map[string]any{"lt": nil, "ty": typ}, u)
	r.NoErrors(t)
	return r.Str(t, "createAddress.id")
}

func addrType(t *testing.T, e *Env, id string) string {
	t.Helper()
	var a models.Address
	if err := e.DB.First(&a, "id = ?", id).Error; err != nil {
		t.Fatal(err)
	}
	return string(a.Type)
}

func TestAddrAuthGates(t *testing.T) {
	e := newEnv(t)
	for name, q := range map[string]string{
		"addresses":     `{ addresses{ id } }`,
		"address":       `{ address(id:"x"){ id } }`,
		"createAddress": `mutation{ createAddress(recipient:"r",lineOne:"l",city:"c",state:"s",zipCode:"z",type:"billing"){ id } }`,
		"updateAddress": `mutation{ updateAddress(id:"x",city:"c"){ id } }`,
		"deleteAddress": `mutation{ deleteAddress(id:"x") }`,
	} {
		authDo(e,q, nil, nil).HasError(t, "Not authenticated")
		_ = name
	}
}

func TestAddrCreate(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("a@example.com", false)

	t.Run("full", func(t *testing.T) {
		r := authDo(e,addrCreate, map[string]any{"lt": "Apt 2", "ty": "shipping"}, u)
		r.NoErrors(t)
		for path, want := range map[string]string{
			"createAddress.recipient": "R", "createAddress.lineOne": "1 Main", "createAddress.lineTwo": "Apt 2",
			"createAddress.city": "C", "createAddress.state": "S", "createAddress.zipCode": "12345",
			"createAddress.country": "United States", "createAddress.type": "shipping", "createAddress.userId": u.ID,
		} {
			if got := r.Str(t, path); got != want {
				t.Errorf("%s = %q, want %q", path, got, want)
			}
		}
	})

	t.Run("lineTwo omitted is null (Node: nullable column)", func(t *testing.T) {
		r := authDo(e,addrCreate, map[string]any{"lt": nil, "ty": "shipping"}, u)
		r.NoErrors(t)
		if r.Get("createAddress.lineTwo") != nil {
			parityBug(t, "createAddress without lineTwo returns \"\" instead of null (Node stores NULL; Address.lineTwo has no default)")
		}
	})

	t.Run("type is free-form string like Node", func(t *testing.T) {
		r := authDo(e,addrCreate, map[string]any{"lt": nil, "ty": "weird"}, u)
		r.NoErrors(t)
		if r.Str(t, "createAddress.type") != "weird" {
			t.Errorf("raw: %s", r.Raw)
		}
	})
}

func TestAddrOwnershipAndCRUD(t *testing.T) {
	e := newEnv(t)
	a := e.NewUser("a@example.com", false)
	b := e.NewUser("b@example.com", false)
	aID := addrMake(t, e, a, "shipping")
	bID := addrMake(t, e, b, "shipping")

	t.Run("list only own", func(t *testing.T) {
		r := authDo(e,`{ addresses{ id userId } }`, nil, a)
		r.NoErrors(t)
		if r.Len(t, "addresses") != 1 || r.Str(t, "addresses.0.id") != aID {
			t.Errorf("raw: %s", r.Raw)
		}
	})

	t.Run("address(id)", func(t *testing.T) {
		r := authDo(e,`query($i:String!){ address(id:$i){ id city } }`, map[string]any{"i": aID}, a)
		r.NoErrors(t)
		if r.Str(t, "address.id") != aID {
			t.Errorf("raw: %s", r.Raw)
		}
		for _, id := range []string{bID, "nonexistent"} {
			r := authDo(e,`query($i:String!){ address(id:$i){ id } }`, map[string]any{"i": id}, a)
			r.HasError(t, "Invalid id")
		}
	})

	t.Run("update partial leaves other fields", func(t *testing.T) {
		r := authDo(e,`mutation($i:String!){ updateAddress(id:$i,city:"New City",zipCode:"99999"){ `+addrFields+` } }`, map[string]any{"i": aID}, a)
		r.NoErrors(t)
		if r.Str(t, "updateAddress.city") != "New City" || r.Str(t, "updateAddress.zipCode") != "99999" ||
			r.Str(t, "updateAddress.recipient") != "R" || r.Str(t, "updateAddress.lineOne") != "1 Main" ||
			r.Str(t, "updateAddress.state") != "S" || r.Str(t, "updateAddress.type") != "shipping" {
			t.Errorf("raw: %s", r.Raw)
		}
		var got models.Address
		e.DB.First(&got, "id = ?", aID)
		if got.City != "New City" || got.Recipient != "R" {
			t.Error("not persisted correctly")
		}
	})

	t.Run("update every field", func(t *testing.T) {
		r := authDo(e,`mutation($i:String!){ updateAddress(id:$i,recipient:"R2",lineOne:"L1",lineTwo:"L2",city:"C2",state:"S2",zipCode:"Z2",type:"shipping"){ `+addrFields+` } }`, map[string]any{"i": aID}, a)
		r.NoErrors(t)
		for path, want := range map[string]string{
			"updateAddress.recipient": "R2", "updateAddress.lineOne": "L1", "updateAddress.lineTwo": "L2",
			"updateAddress.city": "C2", "updateAddress.state": "S2", "updateAddress.zipCode": "Z2",
		} {
			if got := r.Str(t, path); got != want {
				t.Errorf("%s = %q, want %q", path, got, want)
			}
		}
	})

	t.Run("explicit null lineTwo clears it (Node: null !== undefined)", func(t *testing.T) {
		r := authDo(e,`mutation($i:String!){ updateAddress(id:$i,lineTwo:null){ lineTwo } }`, map[string]any{"i": aID}, a)
		r.NoErrors(t)
		if r.Get("updateAddress.lineTwo") != nil {
			parityBug(t, "updateAddress(lineTwo: null) is ignored; Node assigns null and clears the field")
		}
	})

	t.Run("update someone else's / missing -> Invalid id", func(t *testing.T) {
		for _, id := range []string{bID, "nonexistent"} {
			r := authDo(e,`mutation($i:String!){ updateAddress(id:$i,city:"Hax"){ id } }`, map[string]any{"i": id}, a)
			r.HasError(t, "Invalid id")
		}
		var got models.Address
		e.DB.First(&got, "id = ?", bID)
		if got.City == "Hax" {
			t.Error("foreign address modified")
		}
	})

	t.Run("delete", func(t *testing.T) {
		del := `mutation($i:String!){ deleteAddress(id:$i) }`
		r := authDo(e,del, map[string]any{"i": bID}, a)
		r.NoErrors(t)
		if r.Bool(t, "deleteAddress") {
			t.Error("deleting a foreign address returned true")
		}
		var n int64
		e.DB.Model(&models.Address{}).Where("id = ?", bID).Count(&n)
		if n != 1 {
			t.Error("foreign address was deleted")
		}
		r = authDo(e,del, map[string]any{"i": "nonexistent"}, a)
		r.NoErrors(t)
		if r.Bool(t, "deleteAddress") {
			t.Error("deleting a missing address returned true")
		}
		r = authDo(e,del, map[string]any{"i": aID}, a)
		r.NoErrors(t)
		if !r.Bool(t, "deleteAddress") {
			t.Error("own delete should be true")
		}
		e.DB.Model(&models.Address{}).Where("id = ?", aID).Count(&n)
		if n != 0 {
			t.Error("address still exists")
		}
	})
}

func TestAddrBillingUniqueness(t *testing.T) {
	e := newEnv(t)
	a := e.NewUser("a@example.com", false)
	b := e.NewUser("b@example.com", false)
	bOther := addrMake(t, e, b, "billing")

	ship := addrMake(t, e, a, "shipping")
	bill1 := addrMake(t, e, a, "billing")
	if addrType(t, e, ship) != "shipping" || addrType(t, e, bill1) != "billing" {
		t.Fatal("setup: creating billing must not touch shipping")
	}

	bill2 := addrMake(t, e, a, "billing")
	if addrType(t, e, bill1) != "shipping" {
		t.Error("creating a new billing address should demote the previous one")
	}
	if addrType(t, e, bill2) != "billing" {
		t.Error("new billing address lost its type")
	}

	// Promote via update.
	r := authDo(e,`mutation($i:String!){ updateAddress(id:$i,type:"billing"){ type } }`, map[string]any{"i": ship}, a)
	r.NoErrors(t)
	if r.Str(t, "updateAddress.type") != "billing" || addrType(t, e, bill2) != "shipping" {
		t.Errorf("update-to-billing did not demote: ship=%s bill2=%s", addrType(t, e, ship), addrType(t, e, bill2))
	}

	// Updating an unrelated field of the billing address leaves others alone.
	authDo(e,`mutation($i:String!){ updateAddress(id:$i,city:"Z"){ id } }`, map[string]any{"i": ship}, a).NoErrors(t)
	if addrType(t, e, ship) != "billing" || addrType(t, e, bill1) != "shipping" {
		t.Error("unrelated update disturbed billing flags")
	}

	// Never crosses users.
	if addrType(t, e, bOther) != "billing" {
		t.Error("another user's billing address was demoted")
	}
}

func TestAddrUserFields(t *testing.T) {
	e := newEnv(t)
	a := e.NewUser("a@example.com", false)
	b := e.NewUser("b@example.com", false)
	const q = `{ me { addresses{ id type userId } billingAddress{ id type } shippingAddresses{ id type } } }`

	t.Run("no addresses", func(t *testing.T) {
		r := authDo(e,q, nil, a)
		r.NoErrors(t)
		if r.Len(t, "me.addresses") != 0 || r.Len(t, "me.shippingAddresses") != 0 || r.Get("me.billingAddress") != nil {
			t.Errorf("raw: %s", r.Raw)
		}
	})

	s1 := addrMake(t, e, a, "shipping")
	s2 := addrMake(t, e, a, "shipping")
	bill := addrMake(t, e, a, "billing")
	addrMake(t, e, b, "billing")
	addrMake(t, e, b, "shipping")

	r := authDo(e,q, nil, a)
	r.NoErrors(t)
	if r.Len(t, "me.addresses") != 3 {
		t.Errorf("addresses = %d, want 3 (only own)", r.Len(t, "me.addresses"))
	}
	if r.Str(t, "me.billingAddress.id") != bill {
		t.Errorf("billingAddress = %v", r.Get("me.billingAddress"))
	}
	if r.Len(t, "me.shippingAddresses") != 2 {
		t.Fatalf("shippingAddresses = %d", r.Len(t, "me.shippingAddresses"))
	}
	got := map[string]bool{r.Str(t, "me.shippingAddresses.0.id"): true, r.Str(t, "me.shippingAddresses.1.id"): true}
	if !got[s1] || !got[s2] {
		t.Errorf("shippingAddresses ids = %v", got)
	}
	for i := 0; i < 3; i++ {
		if r.Str(t, "me.addresses."+string(rune('0'+i))+".userId") != a.ID {
			t.Error("foreign address in me.addresses")
		}
	}

	// Deleting a user's address is reflected (loaders are per-request).
	authDo(e,`mutation($i:String!){ deleteAddress(id:$i) }`, map[string]any{"i": bill}, a).NoErrors(t)
	r = authDo(e,q, nil, a)
	r.NoErrors(t)
	if r.Get("me.billingAddress") != nil || r.Len(t, "me.addresses") != 2 {
		t.Errorf("after delete: %s", r.Raw)
	}
}
