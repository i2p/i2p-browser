/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* A set abstraction for enumeration values. */

#ifndef mozilla_EnumSet_h
#define mozilla_EnumSet_h

#include "mozilla/Assertions.h"
#include "mozilla/Attributes.h"

#include <initializer_list>
#include <limits>

#include <stdint.h>

namespace mozilla {

/**
 * EnumSet represents a set of multiple values of an enum (or enum class).
 * Template parameter T should be the enum you want to represent.
 * EnumSet is implemented using a bitmask of all possible values of the enum T,
 * and the default type for the bitmask value is uint32_t, so if your enum has
 * more than 32 possible values, you should also supply a backing integer type
 * as template parameter U which has at least as many bits as the number of
 * possible values of enum T.
 */
template <typename T, typename U = uint32_t>
class EnumSet {
 public:
  typedef U serializedType;

  EnumSet() : mBitField(0) {}

  MOZ_IMPLICIT EnumSet(T aEnum) : mBitField(bitFor(aEnum)) {}

  EnumSet(T aEnum1, T aEnum2) : mBitField(bitFor(aEnum1) | bitFor(aEnum2)) {}

  EnumSet(T aEnum1, T aEnum2, T aEnum3)
      : mBitField(bitFor(aEnum1) | bitFor(aEnum2) | bitFor(aEnum3)) {}

  EnumSet(T aEnum1, T aEnum2, T aEnum3, T aEnum4)
      : mBitField(bitFor(aEnum1) | bitFor(aEnum2) | bitFor(aEnum3) |
                  bitFor(aEnum4)) {}

  MOZ_IMPLICIT EnumSet(std::initializer_list<T> list) : mBitField(0) {
    for (auto value : list) {
      (*this) += value;
    }
  }

  EnumSet(const EnumSet& aEnumSet) : mBitField(aEnumSet.mBitField) {}

  /**
   * Add an element
   */
  void operator+=(T aEnum) {
    incVersion();
    mBitField |= bitFor(aEnum);
  }

  /**
   * Add an element
   */
  EnumSet<T, U> operator+(T aEnum) const {
    EnumSet<T, U> result(*this);
    result += aEnum;
    return result;
  }

  /**
   * Union
   */
  void operator+=(const EnumSet<T, U> aEnumSet) {
    incVersion();
    mBitField |= aEnumSet.mBitField;
  }

  /**
   * Union
   */
  EnumSet<T, U> operator+(const EnumSet<T, U> aEnumSet) const {
    EnumSet<T, U> result(*this);
    result += aEnumSet;
    return result;
  }

  /**
   * Remove an element
   */
  void operator-=(T aEnum) {
    incVersion();
    mBitField &= ~(bitFor(aEnum));
  }

  /**
   * Remove an element
   */
  EnumSet<T, U> operator-(T aEnum) const {
    EnumSet<T, U> result(*this);
    result -= aEnum;
    return result;
  }

  /**
   * Remove a set of elements
   */
  void operator-=(const EnumSet<T, U> aEnumSet) {
    incVersion();
    mBitField &= ~(aEnumSet.mBitField);
  }

  /**
   * Remove a set of elements
   */
  EnumSet<T, U> operator-(const EnumSet<T, U> aEnumSet) const {
    EnumSet<T, U> result(*this);
    result -= aEnumSet;
    return result;
  }

  /**
   * Clear
   */
  void clear() {
    incVersion();
    mBitField = 0;
  }

  /**
   * Intersection
   */
  void operator&=(const EnumSet<T, U> aEnumSet) {
    incVersion();
    mBitField &= aEnumSet.mBitField;
  }

  /**
   * Intersection
   */
  EnumSet<T, U> operator&(const EnumSet<T, U> aEnumSet) const {
    EnumSet<T, U> result(*this);
    result &= aEnumSet;
    return result;
  }

  /**
   * Equality
   */
  bool operator==(const EnumSet<T, U> aEnumSet) const {
    return mBitField == aEnumSet.mBitField;
  }

  /**
   * Test is an element is contained in the set.
   */
  bool contains(T aEnum) const { return mBitField & bitFor(aEnum); }

  /**
   * Return the number of elements in the set.
   */
  uint8_t size() const {
    uint8_t count = 0;
    for (serializedType bitField = mBitField; bitField; bitField >>= 1) {
      if (bitField & 1) {
        count++;
      }
    }
    return count;
  }

  bool isEmpty() const { return mBitField == 0; }

  serializedType serialize() const { return mBitField; }

  void deserialize(serializedType aValue) {
    incVersion();
    mBitField = aValue;
  }

  class ConstIterator {
    const EnumSet<T, U>* mSet;
    uint32_t mPos;
#ifdef DEBUG
    uint64_t mVersion;
#endif

    void checkVersion() const {
      // Check that the set has not been modified while being iterated.
      MOZ_ASSERT_IF(mSet, mSet->mVersion == mVersion);
    }

   public:
    ConstIterator(const EnumSet<T, U>& aSet, uint32_t aPos)
        : mSet(&aSet), mPos(aPos) {
#ifdef DEBUG
      mVersion = mSet->mVersion;
#endif
      MOZ_ASSERT(aPos <= kMaxBits);
      if (aPos != kMaxBits && !mSet->contains(T(mPos))) ++*this;
    }

    ConstIterator(const ConstIterator& aOther)
        : mSet(aOther.mSet), mPos(aOther.mPos) {
#ifdef DEBUG
      mVersion = aOther.mVersion;
      checkVersion();
#endif
    }

    ConstIterator(ConstIterator&& aOther)
        : mSet(aOther.mSet), mPos(aOther.mPos) {
#ifdef DEBUG
      mVersion = aOther.mVersion;
      checkVersion();
#endif
      aOther.mSet = nullptr;
    }

    ~ConstIterator() { checkVersion(); }

    bool operator==(const ConstIterator& other) const {
      MOZ_ASSERT(mSet == other.mSet);
      checkVersion();
      return mPos == other.mPos;
    }

    bool operator!=(const ConstIterator& other) const {
      return !(*this == other);
    }

    T operator*() const {
      MOZ_ASSERT(mSet);
      MOZ_ASSERT(mPos < kMaxBits);
      MOZ_ASSERT(mSet->contains(T(mPos)));
      checkVersion();
      return T(mPos);
    }

    ConstIterator& operator++() {
      MOZ_ASSERT(mSet);
      MOZ_ASSERT(mPos < kMaxBits);
      checkVersion();
      do {
        mPos++;
      } while (mPos < kMaxBits && !mSet->contains(T(mPos)));
      return *this;
    }
  };

  ConstIterator begin() const { return ConstIterator(*this, 0); }

  ConstIterator end() const { return ConstIterator(*this, kMaxBits); }

 private:
  static serializedType bitFor(T aEnum) {
    uint32_t bitNumber = (uint32_t)aEnum;
    MOZ_ASSERT(bitNumber < kMaxBits);
    return (serializedType)1 << bitNumber;
  }

  void incVersion() {
#ifdef DEBUG
    mVersion++;
#endif
  }

  static const size_t kMaxBits = std::numeric_limits<serializedType>::digits;
  serializedType mBitField;

#ifdef DEBUG
  uint64_t mVersion = 0;
#endif
};

}  // namespace mozilla

#endif /* mozilla_EnumSet_h_*/
